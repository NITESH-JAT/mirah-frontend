import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useOutletContext } from 'react-router-dom';
import EmojiPicker from 'emoji-picker-react';
import { useAuth } from '../../context/AuthContext';
import { chatService } from '../../services/chatService';

const PERSONAL_INFO_BLOCK_TOAST =
  'For your safety and to ensure a secure transaction, sharing personal contact details (such as phone numbers or addresses) is not allowed on Mirah. Please keep all communication within the platform.';

function fullName(u) {
  if (!u) return '';
  return [u.firstName, u.lastName].filter(Boolean).join(' ').trim();
}

function normalizeText(s) {
  return String(s ?? '').trim().replace(/\s+/g, ' ');
}

function looksLikeBlockedPlaceholderMessage(m) {
  // Backend may replace flagged content with a generic placeholder.
  const content = normalizeText(m?.content).toLowerCase();
  if (!content) return false;
  if (m?.attachmentUrl) return false;
  if (m?.messageType && String(m.messageType).toLowerCase() !== 'text') return false;
  if (content === 'not allowed' || content === 'not allowed.' || content === '[not allowed]') return true;
  // Handle other variants (kept conservative to avoid accidental filtering).
  if (content.length <= 80 && /\bnot\s+allowed\b/.test(content)) return true;
  if (content.length <= 80 && /\bmessage\s+not\s+allowed\b/.test(content)) return true;
  return false;
}

function avatarUrlFor(user) {
  const name = fullName(user) || user?.email || 'User';
  const direct =
    user?.profileImageUrl ||
    user?.profileImage ||
    user?.avatarUrl ||
    user?.photoUrl ||
    null;
  if (direct) return direct;
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=6B5545&color=F2E6D4`;
}

function timeAgoLabel(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '';
  const diff = Date.now() - d.getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const day = Math.floor(hr / 24);
  return `${day}d`;
}

function formatMessageDateTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '';
  const date = d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
  const time = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  return `${date} • ${time}`;
}

function filenameFromUrl(url) {
  if (!url) return '';
  const s = String(url);
  const withoutQuery = s.split('?')[0];
  const parts = withoutQuery.split('/');
  return parts[parts.length - 1] || s;
}

function getEntityId(x) {
  if (!x) return null;
  return x.id ?? x._id ?? x.userId ?? x.recipientId ?? null;
}

function normalizeConversation(c) {
  const id = c?.id ?? c?._id;
  const admin =
    c?.admin && (c.admin?.id || c.admin?._id || Object.keys(c.admin || {}).length > 0)
      ? c.admin
      : null;
  const otherUser = c?.otherUser ?? c?.user ?? c?.recipient ?? null;
  const unreadCount = Number(c?.unreadCount ?? c?.unread ?? 0) || 0;
  const lastMessage = c?.lastMessage ?? c?.last ?? null;
  const updatedAt = c?.updatedAt ?? c?.lastMessageAt ?? lastMessage?.createdAt ?? c?.createdAt;
  const isOnline = Boolean(
    (admin && admin?.isOnline) ||
      (otherUser && otherUser?.isOnline) ||
      c?.isOnline ||
      c?.otherUserIsOnline
  );
  return { raw: c, id, admin, otherUser, unreadCount, lastMessage, updatedAt, isOnline };
}

function normalizeMessage(m) {
  const id = m?.id ?? m?._id;
  const attachmentUrl =
    m?.attachmentUrl ??
    m?.attachmentURL ??
    m?.attachment ??
    m?.fileUrl ??
    m?.fileURL ??
    m?.file ??
    m?.mediaUrl ??
    m?.mediaURL ??
    m?.url ??
    m?.documentUrl ??
    m?.documentURL ??
    m?.imageUrl ??
    m?.imageURL ??
    m?.attachment?.url ??
    m?.attachment?.key ??
    null;
  const messageType =
    m?.messageType ??
    m?.type ??
    (attachmentUrl ? 'file' : 'text');
  const senderTypeRaw = m?.senderType ?? m?.sender_type ?? m?.sender?.userType ?? m?.sender?.role ?? null;
  const senderType = senderTypeRaw != null ? String(senderTypeRaw).trim().toLowerCase() : null;
  return {
    id,
    content: m?.content ?? m?.text ?? '',
    messageType,
    attachmentUrl,
    senderType,
    senderId: m?.senderId ?? m?.sender?.id ?? null,
    sender: m?.sender ?? null,
    isRead: Boolean(m?.isRead ?? m?.read ?? m?.readAt),
    createdAt: m?.createdAt ?? m?.timestamp ?? null,
  };
}

export default function Messages() {
  const { addToast } = useOutletContext();
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [mobileView, setMobileView] = useState('list'); // 'list' | 'thread'
  const [showEmoji, setShowEmoji] = useState(false);
  const [showSafetyBanner, setShowSafetyBanner] = useState(true);

  const [loadingConvos, setLoadingConvos] = useState(true);
  const [conversations, setConversations] = useState([]);
  const [activeConvoId, setActiveConvoId] = useState(null);

  const [loadingMessages, setLoadingMessages] = useState(false);
  const [messages, setMessages] = useState([]);

  const [composer, setComposer] = useState('');
  const [sending, setSending] = useState(false);

  const [search, setSearch] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState([]);

  const messagesEndRef = useRef(null);
  const composerRef = useRef(null);
  const attachmentInputRef = useRef(null);
  const emojiMenuRef = useRef(null);
  const msgPollTimerRef = useRef(null);
  const convoAbortRef = useRef(null);
  const msgLoadAbortRef = useRef(null);
  const msgPollAbortRef = useRef(null);
  const msgBackoffMsRef = useRef(0);
  const lastSeenRef = useRef({ ts: 0, id: null });
  const lastConversationIdRef = useRef(0);
  const activeConvoIdRef = useRef(null);
  const loadSeqRef = useRef(0);
  const msgInFlightRef = useRef(false);
  const conversationsRef = useRef([]);
  const prefillAppliedRef = useRef(null);
  const deepLinkAppliedRef = useRef(false);
  const pendingSupportOpenRef = useRef(null);
  const [pendingSupportTick, setPendingSupportTick] = useState(0);

  const isVendor = user?.userType === 'vendor' || user?.userType === 'jeweller';
  const searchType = isVendor ? 'customer' : 'vendor';
  const messagesRoute = isVendor ? '/vendor/messages' : '/customer/messages';

  const normalizedConvos = useMemo(
    () => conversations.map(normalizeConversation),
    [conversations]
  );

  const supportConvo = useMemo(() => {
    const existing = normalizedConvos.find((c) => Boolean(c.admin));
    if (existing) return existing;
    // Placeholder entry to satisfy PRD: Support entry always shown first
    return {
      id: 'support',
      admin: { id: 'admin', firstName: 'Support', lastName: '' },
      otherUser: null,
      unreadCount: 0,
      lastMessage: null,
      updatedAt: null,
      raw: null,
      isPlaceholder: true,
    };
  }, [normalizedConvos]);

  // If some other page requests opening support, wait until we have the real
  // support conversation id (it can differ from the placeholder "support" id).
  useEffect(() => {
    const pending = pendingSupportOpenRef.current;
    if (!pending) return;
    const supportId = supportConvo?.id;
    if (!supportId) return;
    setActiveConvoId(supportId);
  }, [supportConvo?.id, pendingSupportTick]);

  const sortedConvos = useMemo(() => {
    const others = normalizedConvos.filter((c) => !c.admin);
    others.sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
    return [supportConvo, ...others];
  }, [normalizedConvos, supportConvo]);

  const visibleMessages = useMemo(() => {
    return (messages || []).filter((m) => !looksLikeBlockedPlaceholderMessage(m));
  }, [messages]);

  const activeConvo = useMemo(() => {
    return sortedConvos.find((c) => String(c.id) === String(activeConvoId)) || null;
  }, [sortedConvos, activeConvoId]);

  const activeHeaderUser = activeConvo?.admin || activeConvo?.otherUser;

  useEffect(() => {
    activeConvoIdRef.current = activeConvoId;
  }, [activeConvoId]);

  useEffect(() => {
    conversationsRef.current = Array.isArray(conversations) ? conversations : [];

    // Track lastConversationId for PRD poll endpoint (best-effort max numeric ID)
    let maxId = 0;
    for (const c of conversationsRef.current) {
      const id = getEntityId(c);
      const n = Number(id);
      if (!Number.isNaN(n) && n > maxId) maxId = n;
    }
    lastConversationIdRef.current = maxId;
  }, [conversations]);

  const applyConversationList = React.useCallback((items) => {
    const arr = Array.isArray(items) ? items : [];
    const activeId = activeConvoId ? String(activeConvoId) : null;
    if (!activeId) return arr;
    const hasActive = arr.some((c) => String(c?.id ?? c?._id) === activeId);
    if (hasActive) return arr;
    const prevActive = (conversationsRef.current || []).find((c) => String(c?.id ?? c?._id) === activeId);
    return prevActive ? [prevActive, ...arr] : arr;
  }, [activeConvoId]);

  const computeNewestKey = (msgs) => {
    let maxTs = 0;
    let maxId = null;
    for (const m of msgs || []) {
      const t = m?.createdAt ? new Date(m.createdAt).getTime() : 0;
      if (!Number.isNaN(t) && t > maxTs) maxTs = t;
      const idNum = typeof m?.id === 'number' ? m.id : Number(m?.id);
      if (!Number.isNaN(idNum)) {
        if (maxId == null || idNum > maxId) maxId = idNum;
      }
    }
    return { ts: maxTs || 0, id: maxId ?? null };
  };

  useEffect(() => {
    const load = async () => {
      setLoadingConvos(true);
      try {
        const items = await chatService.listConversations();
        setConversations(items);
        // Do not auto-select a chat (desktop shows empty-state until user picks one)
        setActiveConvoId((prev) => prev ?? null);
      } catch (e) {
        addToast(e?.message || 'Failed to load conversations', 'error');
      } finally {
        setLoadingConvos(false);
      }
    };
    load();
  }, [addToast]);

  // Allow other pages to open Support chat with a prefilled draft message.
  useEffect(() => {
    const state = location?.state || null;
    const prefill = state?.supportPrefill ?? state?.prefill ?? null;
    const openSupport = Boolean(state?.openSupport);
    if (!openSupport || !prefill) return;

    // Allow re-triggering when another page requests opening support.
    // We still clear route state below to avoid re-running on refresh/back.
    const signature = `${String(openSupport)}:${String(prefill)}`;
    prefillAppliedRef.current = signature;
    setMobileView('thread');
    setComposer(String(prefill));
    setShowEmoji(false);
    setTimeout(() => composerRef.current?.focus?.(), 50);
    pendingSupportOpenRef.current = { signature };
    setPendingSupportTick((x) => x + 1);

    // Clear route state to avoid reapplying on back/refresh.
    navigate(messagesRoute, { replace: true, state: {} });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location?.state]);

  // Allow other pages to open a thread with a specific recipientId (e.g., "Chat Now").
  useEffect(() => {
    const state = location?.state || null;
    const recipientId = state?.openRecipientId ?? state?.recipientId ?? state?.recipient?.id ?? null;
    if (!recipientId || deepLinkAppliedRef.current) return;
    deepLinkAppliedRef.current = true;

    (async () => {
      try {
        const res = await chatService.createOrFindConversation({ recipientId });
        const convo = res?.conversation ?? res;
        const convoId = getEntityId(convo);
        if (convoId) setActiveConvoId(convoId);
        // Fetch messages immediately so thread doesn't appear blank while conversations load.
        if (convoId) {
          setMobileView('thread');
          await loadMessagesFor({ id: convoId });
        }

        const items = await chatService.listConversations();
        setConversations(applyConversationList(items));
        if (window.innerWidth < 768) setMobileView('thread');
      } catch (e) {
        addToast(e?.message || 'Unable to start conversation', 'error');
      } finally {
        // Clear route state to avoid reapplying on back/refresh.
        navigate(messagesRoute, { replace: true, state: {} });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location?.state]);

  const loadMessagesFor = async (convo) => {
    if (!convo) return;
    if (String(convo.id) === 'support' && convo.isPlaceholder) {
      setMessages([]);
      lastSeenRef.current = { ts: 0, id: null };
      return;
    }
    if (!convo.id) return;
    const seq = ++loadSeqRef.current;
    setLoadingMessages(true);
    setMessages([]);
    setShowEmoji(false);

    // cancel any in-flight initial-load request when switching
    if (msgLoadAbortRef.current) msgLoadAbortRef.current.abort();
    const ac = new AbortController();
    msgLoadAbortRef.current = ac;
    try {
      const res = await chatService.getMessages({ conversationId: convo.id, page: 1, limit: 50, signal: ac.signal });
      if (seq !== loadSeqRef.current) return; // stale response after a fast switch
      const items = res?.messages ?? [];
      const normalizedAll = items.map(normalizeMessage);
      const newestKey = computeNewestKey(normalizedAll);
      const normalized = normalizedAll.filter((m) => !looksLikeBlockedPlaceholderMessage(m));
      setMessages(normalized);
      lastSeenRef.current = newestKey;
      msgBackoffMsRef.current = 0;

      // Merge updated conversation (includes online flags) into list
      if (res?.conversation) {
        setConversations((prev) => {
          const next = Array.isArray(prev) ? [...prev] : [];
          const idx = next.findIndex((c) => String(c?.id ?? c?._id) === String(res.conversation?.id ?? res.conversation?._id ?? convo.id));
          if (idx === -1) return prev;
          const existing = next[idx] || {};
          const merged = {
            ...existing,
            ...res.conversation,
            otherUser: { ...(existing.otherUser || {}), ...(res.conversation.otherUser || {}) },
            admin: { ...(existing.admin || {}), ...(res.conversation.admin || {}) },
          };
          next[idx] = merged;
          return next;
        });
      }

      // Mark latest unread message as read (lightweight)
      const latestUnreadFromOther = [...normalized]
        .reverse()
        .find((m) => !m.isRead && m.senderId && String(m.senderId) !== String(user?.id));
      if (latestUnreadFromOther?.id) {
        try {
          await chatService.markMessageRead({ conversationId: convo.id, messageId: latestUnreadFromOther.id });
        } catch {
          // ignore read failures
        }
      }
    } catch (e) {
      if (e?.code === 'ERR_CANCELED' || e?.name === 'CanceledError') return;
      addToast(e?.message || 'Failed to load messages', 'error');
    } finally {
      if (seq === loadSeqRef.current) setLoadingMessages(false);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    }
  };

  useEffect(() => {
    if (!activeConvoId) return;
    if (!activeConvo) return;
    loadMessagesFor(activeConvo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeConvoId, activeConvo?.id]);

  useEffect(() => {
    const q = search.trim();
    if (!q) {
      setSearchResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const users = await chatService.searchUsers({ type: searchType, search: q, page: 1, limit: 10 });
        setSearchResults(users);
      } catch {
        // show nothing; gates may block vendor search
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [search, searchType]);

  useEffect(() => {
    if (!showEmoji) return;
    const onDown = (e) => {
      const menu = emojiMenuRef.current;
      const btn = e.target?.closest?.('[data-emoji-trigger="true"]');
      if (btn) return;
      if (menu && !menu.contains(e.target)) setShowEmoji(false);
    };
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [showEmoji]);

  const insertAtCursor = (text) => {
    const input = composerRef.current;
    if (!input) {
      setComposer((prev) => `${prev}${text}`);
      return;
    }
    const start = input.selectionStart ?? composer.length;
    const end = input.selectionEnd ?? composer.length;
    const next = `${composer.slice(0, start)}${text}${composer.slice(end)}`;
    const cursor = start + text.length;
    setComposer(next);
    setTimeout(() => {
      try {
        input.focus();
        input.setSelectionRange(cursor, cursor);
      } catch {
        // ignore
      }
    }, 0);
  };

  const handleSelectSearchUser = async (u) => {
    const recipientId = getEntityId(u);
    if (!recipientId) return;
    setSearch('');
    setSearchResults([]);
    try {
      const res = await chatService.createOrFindConversation({ recipientId });
      // backend may return {conversation} or full convo
      const convo = res?.conversation ?? res;
      const convoId = getEntityId(convo);
      if (convoId) setActiveConvoId(convoId);

      // Optimistically keep the convo so header doesn't fall back to Support
      if (convoId) {
        setConversations((prev) => {
          const list = Array.isArray(prev) ? [...prev] : [];
          const idx = list.findIndex((c) => String(c?.id ?? c?._id) === String(convoId));
          if (idx === -1) return [convo, ...list];
          const existing = list[idx] || {};
          list[idx] = {
            ...existing,
            ...convo,
            otherUser: { ...(existing.otherUser || {}), ...(convo?.otherUser || {}) },
            admin: { ...(existing.admin || {}), ...(convo?.admin || {}) },
          };
          return list;
        });
      }

      // refresh list and select (server source of truth)
      const items = await chatService.listConversations();
      const normalized = (Array.isArray(items) ? items : []).map(normalizeConversation);
      const found = normalized.find((c) => String(getEntityId(c.otherUser)) === String(recipientId));
      const foundId = getEntityId(found) ?? convoId;
      if (foundId) setActiveConvoId(foundId);
      setConversations(applyConversationList(items));
      if (window.innerWidth < 768) setMobileView('thread');
    } catch (e) {
      addToast(e?.message || 'Unable to start conversation', 'error');
    }
  };

  const refreshConversations = React.useCallback(async () => {
    if (convoAbortRef.current) convoAbortRef.current.abort();
    const ac = new AbortController();
    convoAbortRef.current = ac;
    const items = await chatService.listConversations({ signal: ac.signal });
    setConversations(applyConversationList(items));
    return items;
  }, [applyConversationList]);

  // PRD poll endpoint: works even with no active thread
  useEffect(() => {
    let cancelled = false;

    const schedule = (ms) => {
      if (cancelled) return;
      if (msgPollTimerRef.current) clearTimeout(msgPollTimerRef.current);
      msgPollTimerRef.current = setTimeout(tick, ms);
    };

    const mergeConversationFromMessagesResponse = (conversation) => {
      if (!conversation) return;
      setConversations((prev) => {
        const next = Array.isArray(prev) ? [...prev] : [];
        const convoKey = String(conversation?.id ?? conversation?._id ?? activeConvoIdRef.current);
        const idx = next.findIndex((c) => String(c?.id ?? c?._id) === convoKey);
        if (idx === -1) return prev;
        const existing = next[idx] || {};
        next[idx] = {
          ...existing,
          ...conversation,
          otherUser: { ...(existing.otherUser || {}), ...(conversation.otherUser || {}) },
          admin: { ...(existing.admin || {}), ...(conversation.admin || {}) },
        };
        return next;
      });
    };

    const tick = async () => {
      if (cancelled) return;
      if (msgInFlightRef.current) {
        schedule(1500);
        return;
      }

      if (document.hidden) {
        // pause while hidden
        schedule(60_000);
        return;
      }

      try {
        msgInFlightRef.current = true;
        if (msgPollAbortRef.current) msgPollAbortRef.current.abort();
        const ac = new AbortController();
        msgPollAbortRef.current = ac;

        const activeId = activeConvoIdRef.current;
        const shouldPollThread =
          Boolean(activeId) &&
          String(activeId) !== 'support' &&
          !(activeConvo?.isPlaceholder);

        const pollParams = {
          lastConversationId: lastConversationIdRef.current || 0,
          signal: ac.signal,
        };
        if (shouldPollThread) {
          pollParams.conversationId = activeId;
          pollParams.lastMessageId = lastSeenRef.current?.id ?? 0;
        }

        const poll = await chatService.poll(pollParams);

        // PRD: hasNewConversation OR hasAnyNewMessage => refetch conversations list
        if (poll?.hasNewConversation || poll?.hasAnyNewMessage) {
          refreshConversations().catch(() => {});
        }

        if (poll?.hasNewMessage && shouldPollThread) {
          const convoIdAtStart = activeId;
          const res = await chatService.getMessages({
            conversationId: convoIdAtStart,
            page: 1,
            limit: 50,
            signal: ac.signal,
          });
          if (String(activeConvoIdRef.current) !== String(convoIdAtStart)) return; // switched mid-flight
          mergeConversationFromMessagesResponse(res?.conversation);

          const normalized = (res?.messages ?? []).map(normalizeMessage);
          const newest = computeNewestKey(normalized);
          const lastSeen = lastSeenRef.current || { ts: 0, id: null };

          const newer = normalized.filter((m) => {
            const t = m?.createdAt ? new Date(m.createdAt).getTime() : 0;
            if (!Number.isNaN(t) && lastSeen.ts) return t > lastSeen.ts;
            if (!Number.isNaN(t) && !lastSeen.ts) return false; // avoid duplicates before initial load establishes baseline
            const idNum = typeof m?.id === 'number' ? m.id : Number(m?.id);
            if (!Number.isNaN(idNum) && lastSeen.id != null) return idNum > lastSeen.id;
            return false;
          });

          if (newer.length > 0) {
            setMessages((prev) => {
              const prevArr = Array.isArray(prev) ? prev : [];
              const seen = new Set(prevArr.map((p) => String(p.id)));
              const toAddAll = newer.filter((m) => !seen.has(String(m.id)));
              const toAdd = toAddAll.filter((m) => !looksLikeBlockedPlaceholderMessage(m));
              return toAdd.length ? [...prevArr, ...toAdd] : prevArr;
            });
            lastSeenRef.current = newest;
            setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
          }

          // Refresh list when new messages arrive (unread/order)
          refreshConversations().catch(() => {});
        }

        msgBackoffMsRef.current = 0;
        schedule(30_000);
      } catch (e) {
        if (e?.code === 'ERR_CANCELED' || e?.name === 'CanceledError') return;
        const status = e?.response?.status;
        if (status === 401) return; // interceptor handles
        const prev = msgBackoffMsRef.current || 0;
        const next = prev === 0 ? 2000 : prev <= 5000 ? 5000 : prev <= 10_000 ? 10_000 : 30_000;
        msgBackoffMsRef.current = next;
        schedule(next);
      } finally {
        msgInFlightRef.current = false;
      }
    };

    const onVis = () => {
      if (!document.hidden) tick();
    };

    // Kick off with a fast window when user opens a convo
    msgBackoffMsRef.current = 0;
    tick();
    document.addEventListener('visibilitychange', onVis);

    return () => {
      cancelled = true;
      if (msgPollTimerRef.current) clearTimeout(msgPollTimerRef.current);
      if (msgPollAbortRef.current) msgPollAbortRef.current.abort();
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [activeConvoId, activeConvo?.isPlaceholder, refreshConversations]);

  const handleSend = async () => {
    const text = composer.trim();
    if (!text || sending) return;

    setSending(true);
    try {
      // Support placeholder: first message must use admin endpoint (PRD)
      if (String(activeConvoId) === 'support' && activeConvo?.isPlaceholder) {
        await chatService.sendAdminSupportMessage({ content: text, messageType: 'text' });
        setComposer('');
        // refresh conversations; admin convo should now exist
        const items = await refreshConversations();
        const normalized = items.map(normalizeConversation);
        const adminConvo = normalized.find((c) => Boolean(c.admin));
        if (adminConvo?.id) setActiveConvoId(adminConvo.id);
        if (window.innerWidth < 768) setMobileView('thread');
        return;
      }

      if (!activeConvo?.id) return;
      const res = await chatService.sendMessage({ conversationId: activeConvo.id, content: text, messageType: 'text' });
      const msg = normalizeMessage(res?.message ?? res?.data?.message ?? res?.message ?? res);
      if (looksLikeBlockedPlaceholderMessage(msg)) {
        addToast(PERSONAL_INFO_BLOCK_TOAST, 'error');
        setComposer('');
        await refreshConversations();
        await loadMessagesFor(activeConvo);
        return;
      }
      setComposer('');
      if (msg?.id) {
        setMessages((prev) => [...prev, msg]);
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
      } else {
        // fallback refresh
        await loadMessagesFor(activeConvo);
      }

      // refresh list so lastMessage/unread count is accurate
      await refreshConversations();
    } catch (e) {
      addToast(e?.message || 'Failed to send message', 'error');
    } finally {
      setSending(false);
    }
  };

  const handleSendAttachment = async (file, messageType) => {
    if (!file || sending) return;
    setSending(true);
    try {
      // Support placeholder: first message/file must use admin endpoint (PRD)
      if (String(activeConvoId) === 'support' && activeConvo?.isPlaceholder) {
        await chatService.sendAdminSupportMessageMultipart({ content: '', messageType, file });
        const items = await refreshConversations();
        const normalized = items.map(normalizeConversation);
        const adminConvo = normalized.find((c) => Boolean(c.admin));
        if (adminConvo?.id) setActiveConvoId(adminConvo.id);
        if (window.innerWidth < 768) setMobileView('thread');
        return;
      }

      if (!activeConvo?.id) return;
      const res = await chatService.sendMessageMultipart({
        conversationId: activeConvo.id,
        content: '',
        messageType,
        file,
      });
      const msg = normalizeMessage(res?.message ?? res?.data?.message ?? res?.message ?? res);
      if (msg?.id) {
        setMessages((prev) => [...prev, msg]);
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
      } else {
        await loadMessagesFor(activeConvo);
      }
      await refreshConversations();
      if (window.innerWidth < 768) setMobileView('thread');
    } catch (e) {
      addToast(e?.message || 'Failed to send attachment', 'error');
    } finally {
      setSending(false);
      if (attachmentInputRef.current) attachmentInputRef.current.value = '';
    }
  };

  const listPaneClass = mobileView === 'thread' ? 'hidden md:flex' : 'flex';
  const threadPaneClass = mobileView === 'list' ? 'hidden md:flex' : 'flex';

  return (
    <div className="flex h-full min-h-0 w-full gap-0 overflow-hidden bg-cream">
      {/* Conversations list */}
      <div className={`w-full md:w-[340px] shrink-0 border-r border-pale ${listPaneClass} flex-col min-h-0`}>
        <div className="px-6 pt-6 pb-3">
          <h2 className="font-serif text-[18px] font-bold text-ink">All messages</h2>
        </div>

        <div className="px-6 pb-4 relative">
          <div className="relative">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Search ${isVendor ? 'customers' : 'jewellers'}`}
              className="w-full bg-cream border border-pale rounded-xl px-4 py-3 text-[13px] font-medium focus:outline-none focus:border-walnut"
            />
            {searching && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-muted text-[12px]">…</div>
            )}
          </div>

          {search.trim() && (
            <div className="absolute left-6 right-6 top-[64px] bg-white border border-pale rounded-xl shadow-sm overflow-hidden z-30">
              {searchResults.length === 0 ? (
                <div className="px-4 py-3 text-[12px] text-muted">No results</div>
              ) : (
                searchResults.map((u) => (
                  <button
                    key={String(getEntityId(u) ?? u.email ?? fullName(u))}
                    type="button"
                    onClick={() => handleSelectSearchUser(u)}
                    className="w-full text-left px-4 py-3 hover:bg-cream border-b border-pale last:border-0 cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <img src={avatarUrlFor(u)} alt="" className="w-9 h-9 rounded-full" />
                      <div>
                        <p className="text-[13px] font-bold text-ink">{fullName(u) || u.email}</p>
                        <p className="text-[11px] text-muted capitalize">{u.userType}</p>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto">
          {loadingConvos ? (
            <div className="min-h-[240px] px-6 py-10 flex items-center justify-center">
              <svg
                className="animate-spin text-ink"
                xmlns="http://www.w3.org/2000/svg"
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
              >
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.2" />
                <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
              </svg>
            </div>
          ) : (
            sortedConvos.map((c) => {
              const isActive = String(c.id) === String(activeConvoId);
              const who = c.admin ? { firstName: 'Support', lastName: '' } : c.otherUser;
              const name = c.admin ? 'Support' : fullName(who) || 'Unknown';
              const lastRaw = c.lastMessage?.content || c.lastMessage?.text || '';
              const last = looksLikeBlockedPlaceholderMessage({ content: lastRaw, messageType: 'text' })
                ? (c.admin ? 'Contact support' : 'Start a conversation')
                : (lastRaw || (c.admin ? 'Contact support' : 'Start a conversation'));
              const ts = c.lastMessage?.createdAt || c.updatedAt;
              return (
                <button
                  key={String(c.id)}
                  type="button"
                  onClick={() => {
                    setActiveConvoId(c.id);
                    setLoadingMessages(true);
                    setMessages([]);
                    if (window.innerWidth < 768) setMobileView('thread');
                  }}
                  className={`w-full px-6 py-4 flex items-start gap-3 text-left border-b border-pale cursor-pointer transition-colors
                    ${isActive ? 'bg-blush' : 'hover:bg-blush/70'}
                  `}
                >
                  <img src={avatarUrlFor(who)} alt="" className="w-10 h-10 rounded-full" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[13px] font-bold text-ink truncate">{name}</p>
                      <p className="text-[11px] text-muted shrink-0">{timeAgoLabel(ts)}</p>
                    </div>
                    <div className="mt-0.5 flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${c.isOnline ? 'bg-green-500' : 'bg-red-400'}`} />
                      <span className="text-[11px] text-muted">{c.isOnline ? 'Online' : 'Offline'}</span>
                    </div>
                    <p className="text-[12px] text-muted truncate">{last}</p>
                  </div>
                  {c.unreadCount > 0 && (
                    <div className="mt-1 w-2.5 h-2.5 bg-green-500 rounded-full shrink-0" />
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Thread */}
      <div className={`flex-1 ${threadPaneClass} flex-col min-w-0 min-h-0`}>
        {!activeConvoId ? (
          <div className="flex-1 flex items-center justify-center bg-white">
            <div className="text-center px-8 max-w-md">
              <div className="mx-auto w-14 h-14 rounded-2xl bg-cream border border-pale flex items-center justify-center text-muted">
                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a4 4 0 0 1-4 4H7l-4 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/></svg>
              </div>
              <h3 className="mt-4 font-serif text-[18px] font-bold text-ink">Select a chat</h3>
              <p className="mt-1 text-[13px] text-muted">
                Choose a conversation from the left to start messaging.
              </p>
              <button
                type="button"
                onClick={() => setMobileView('list')}
                className="mt-6 md:hidden inline-flex items-center justify-center px-4 py-2 rounded-xl border border-pale text-mid hover:bg-cream cursor-pointer"
              >
                Back to chats
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="h-14 border-b border-pale px-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setMobileView('list')}
                  className="md:hidden p-2 -ml-2 rounded-lg hover:bg-cream text-mid transition-colors cursor-pointer"
                  aria-label="Back to chats"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
                </button>
                <img src={avatarUrlFor(activeHeaderUser)} alt="" className="w-9 h-9 rounded-full" />
                <div>
                  <p className="text-[13px] font-bold text-ink">{activeConvo?.admin ? 'Support' : fullName(activeHeaderUser) || 'Conversation'}</p>
                  <div className="mt-0.5 flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${activeConvo?.isOnline ? 'bg-green-500' : 'bg-red-400'}`} />
                    <span className="text-[11px] text-muted">{activeConvo?.isOnline ? 'Online' : 'Offline'}</span>
                  </div>
                </div>
              </div>
            </div>
            {showSafetyBanner && !activeConvo?.admin ? (
              <div className="px-5 py-3">
                <div className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-[12px] text-red-700 flex items-start justify-between gap-3">
                  <p>
                    <span className="font-semibold">For safety, keep all communication in Mirah Chat.</span>{' '}
                    Messages are visible to Admin.
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowSafetyBanner(false)}
                    className="shrink-0 text-red-500 hover:text-red-700 transition-colors cursor-pointer"
                    aria-label="Dismiss safety notice"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M18 6 6 18" />
                      <path d="m6 6 12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            ) : null}

            <div className="flex-1 min-h-0 relative bg-cream overflow-hidden">
              <div className="h-full overflow-y-auto px-5 py-6 space-y-3 relative z-10">
                {loadingMessages ? (
                  <div className="text-[13px] text-muted">Loading messages…</div>
                ) : visibleMessages.length === 0 ? (
                  <div className="text-[13px] text-muted">No messages yet.</div>
                ) : (
                  visibleMessages.map((m) => {
                    const isAdminMsg = String(m.senderType || '').toLowerCase() === 'admin';
                    const mine = String(m.senderId) === String(user?.id) && !isAdminMsg;
                    const hasAttachment = Boolean(m.attachmentUrl);
                    const isImage =
                      m.messageType === 'image' ||
                      (hasAttachment && /\.(png|jpe?g|webp|gif)(\?.*)?$/i.test(String(m.attachmentUrl)));
                    const when = formatMessageDateTime(m.createdAt);
                    const senderForAvatar = mine
                      ? user
                      : isAdminMsg
                        ? { firstName: 'Support', lastName: '' }
                        : (m.sender || activeHeaderUser);
                    return (
                      <div key={String(m.id)} className={`w-full flex ${mine ? 'justify-end' : 'justify-start'}`}>
                        <div className={`flex items-end gap-2 ${mine ? 'flex-row-reverse' : 'flex-row'}`}>
                          <img
                            src={avatarUrlFor(senderForAvatar)}
                            alt=""
                            className="w-7 h-7 rounded-full shrink-0"
                          />
                          <div className={`max-w-[92%] md:max-w-[84%] px-4 py-2.5 rounded-2xl text-[13px] leading-relaxed
                            ${
                              mine
                                ? 'bg-walnut text-blush rounded-br-md'
                                : isAdminMsg
                                  ? 'bg-blush text-ink border border-pale rounded-bl-md'
                                  : 'bg-white text-ink border border-pale rounded-bl-md'
                            }
                          `}>
                            {hasAttachment && isImage ? (
                              <div className="space-y-2">
                                <a href={m.attachmentUrl} target="_blank" rel="noreferrer" className="block">
                                  <img
                                    src={m.attachmentUrl}
                                    alt="Attachment"
                                    className="max-h-[220px] w-auto rounded-xl"
                                  />
                                </a>
                                {m.content ? <div className={`${mine ? 'text-blush/95' : 'text-ink'}`}>{m.content}</div> : null}
                              </div>
                            ) : hasAttachment ? (
                              <div className="space-y-2">
                                <a
                                  href={m.attachmentUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className={`${mine ? 'text-blush/90' : 'text-ink'} underline break-all`}
                                >
                                  {filenameFromUrl(m.attachmentUrl) || 'Attachment'}
                                </a>
                                {m.content ? <div className={`${mine ? 'text-blush/95' : 'text-ink'}`}>{m.content}</div> : null}
                              </div>
                            ) : m.content ? (
                              m.content
                            ) : (
                              ''
                            )}
                            {when ? (
                            <div
                              className={`mt-1 text-[10px] ${mine ? 'text-blush/70' : 'text-muted'} text-right whitespace-nowrap`}
                            >
                                {when}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

            </div>

            <div className="shrink-0 border-t border-pale bg-cream px-3 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-4 sm:pt-4">
              <div className="relative">
                {showEmoji && (
                  <div
                    ref={emojiMenuRef}
                    className="absolute bottom-[calc(100%+10px)] right-0 w-[280px] max-w-[calc(100vw-32px)] bg-white border border-pale rounded-2xl shadow-sm p-3 z-30"
                  >
                <EmojiPicker
                  width={260}
                  height={340}
                  onEmojiClick={(emojiData) => {
                    const emoji = emojiData?.emoji || '';
                    if (emoji) insertAtCursor(emoji);
                    setShowEmoji(false);
                  }}
                />
                  </div>
                )}

                <div className="flex items-center gap-2 pb-3 sm:gap-3">
                  <input
                    ref={composerRef}
                    value={composer}
                onChange={(e) => {
                  setComposer(e.target.value);
                }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                    placeholder="Write your message..."
                    className="min-h-[44px] min-w-0 flex-1 rounded-xl border border-pale bg-white px-3 py-2.5 text-[13px] font-medium focus:border-walnut focus:outline-none sm:min-h-[46px] sm:px-4 sm:text-[14px]"
                  />

                  {/* Single attachment input (images + pdf) */}
                  <input
                    ref={attachmentInputRef}
                    type="file"
                    accept="image/*,application/pdf"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const isImage = String(file.type || '').startsWith('image/');
                      handleSendAttachment(file, isImage ? 'image' : 'file');
                    }}
                  />

                  <div className="flex shrink-0 items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => attachmentInputRef.current?.click()}
                      disabled={sending}
                      className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-pale bg-white text-muted hover:bg-cream disabled:cursor-not-allowed disabled:opacity-50 sm:h-10 sm:w-10 sm:rounded-xl"
                      aria-label="Upload attachment"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.44 11.05 12.25 20.24a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
                    </button>
                    <button
                      type="button"
                      data-emoji-trigger="true"
                      onClick={() => setShowEmoji((v) => !v)}
                      disabled={sending}
                      className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-pale bg-white text-muted hover:bg-cream disabled:cursor-not-allowed disabled:opacity-50 sm:h-10 sm:w-10 sm:rounded-xl"
                      aria-label="Emoji"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" />
                        <path d="M8.5 15s1.5 2 3.5 2 3.5-2 3.5-2" />
                        <path d="M9 9h.01" />
                        <path d="M15 9h.01" />
                      </svg>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={handleSend}
                    disabled={sending || !composer.trim()}
                    className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-xl bg-walnut text-blush disabled:cursor-not-allowed disabled:opacity-50 sm:h-11 sm:w-11"
                    aria-label="Send"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M3.4 20.6 21 12 3.4 3.4 3 10l12 2-12 2z"/></svg>
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

