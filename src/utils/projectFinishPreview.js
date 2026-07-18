import img9Y from '../assets/project-specs/9Y.png';
import img9W from '../assets/project-specs/9W.png';
import img9R from '../assets/project-specs/9R.png';
import img14Y from '../assets/project-specs/14Y.png';
import img14W from '../assets/project-specs/14W.png';
import img14R from '../assets/project-specs/14R.png';
import img18Y from '../assets/project-specs/18Y.png';
import img18W from '../assets/project-specs/18W.png';
import img18R from '../assets/project-specs/18R.png';
import img22Y from '../assets/project-specs/22Y.png';
import img22W from '../assets/project-specs/22W.png';
import img22R from '../assets/project-specs/22R.png';
import imgD9Y from '../assets/project-specs/D9Y.png';
import imgD9W from '../assets/project-specs/D9W.png';
import imgD9R from '../assets/project-specs/D9R.png';
import imgD14Y from '../assets/project-specs/D14Y.png';
import imgD14W from '../assets/project-specs/D14W.png';
import imgD14R from '../assets/project-specs/D14R.png';
import imgD18Y from '../assets/project-specs/D18Y.png';
import imgD18W from '../assets/project-specs/D18W.png';
import imgD18R from '../assets/project-specs/D18R.png';
import imgD22Y from '../assets/project-specs/D22Y.png';
import imgD22W from '../assets/project-specs/D22W.png';
import imgD22R from '../assets/project-specs/D22R.png';
import naturalPictogram from '../assets/project-specs/natural-pictogram.png';
import labPictogram from '../assets/project-specs/lab-pictogram.png';
import imgOtherMetal from '../assets/project-specs/other-metal.png';
import imgOtherMetalCircle from '../assets/project-specs/other-metal-circle.png';
import imgOtherMetalWithStones from '../assets/project-specs/other-metal-with-stones.png';
import imgTwoToneGold from '../assets/project-specs/two-tone-gold.png';
import imgTwoToneWithStones from '../assets/project-specs/two-tone-with-stones.png';

export { naturalPictogram, labPictogram, imgOtherMetalCircle as otherMetalCircle };

const FINISH_IMAGES = {
  '9Y': img9Y,
  '9W': img9W,
  '9R': img9R,
  '14Y': img14Y,
  '14W': img14W,
  '14R': img14R,
  '18Y': img18Y,
  '18W': img18W,
  '18R': img18R,
  '22Y': img22Y,
  '22W': img22W,
  '22R': img22R,
  D9Y: imgD9Y,
  D9W: imgD9W,
  D9R: imgD9R,
  D14Y: imgD14Y,
  D14W: imgD14W,
  D14R: imgD14R,
  D18Y: imgD18Y,
  D18W: imgD18W,
  D18R: imgD18R,
  D22Y: imgD22Y,
  D22W: imgD22W,
  D22R: imgD22R,
  OTHER: imgOtherMetal,
  OTHER_STONES: imgOtherMetalWithStones,
  TWO_TONE: imgTwoToneGold,
  TWO_TONE_STONES: imgTwoToneWithStones,
};

const COLOUR_LETTER = {
  yellow: 'Y',
  white: 'W',
  rose: 'R',
};

const PURITY_DIGIT = {
  '9kt': '9',
  '9k': '9',
  '14kt': '14',
  '14k': '14',
  '18kt': '18',
  '18k': '18',
  '22kt': '22',
  '22k': '22',
};

/** Resolve plaque key e.g. "18Y" or "D18Y". Platinum→14W, Silver→9W. */
export function resolveFinishKey(specs = {}, { includeDiamonds = true } = {}) {
  const metal = String(specs.metalType || '').trim().toLowerCase();
  const stonesYes = String(specs.stonesIncluded || 'no').trim().toLowerCase() === 'yes';
  const useDiamondPlate = includeDiamonds && stonesYes;
  let base = '18Y';

  if (metal === 'other') {
    return useDiamondPlate ? 'OTHER_STONES' : 'OTHER';
  }

  if (metal === 'platinum') {
    base = '14W';
  } else if (metal === 'silver') {
    base = '9W';
  } else if (metal === 'gold') {
    const colourRaw = String(specs.metalColour || '').trim().toLowerCase();
    if (colourRaw === 'two-tone') {
      return useDiamondPlate ? 'TWO_TONE_STONES' : 'TWO_TONE';
    }
    const purity = PURITY_DIGIT[String(specs.metalPurity || '').trim().toLowerCase()] || '18';
    const colour = COLOUR_LETTER[colourRaw] || 'Y';
    base = `${purity}${colour}`;
  }

  const key = useDiamondPlate ? `D${base}` : base;
  return FINISH_IMAGES[key] ? key : useDiamondPlate ? 'D18Y' : '18Y';
}

export function resolveFinishImageSrc(specs = {}, options = {}) {
  const key = resolveFinishKey(specs, options);
  return FINISH_IMAGES[key] || FINISH_IMAGES['18Y'];
}

function purityDisplay(purity) {
  const raw = String(purity || '').trim();
  if (!raw) return '';
  return raw.replace(/KT$/i, 'k').replace(/kt$/i, 'k');
}

/** Human caption under the finish preview. */
export function buildFinishCaption(specs = {}, { includeDiamonds = true } = {}) {
  const metal = String(specs.metalType || '').trim();
  const metalLower = metal.toLowerCase();
  const parts = [];

  if (metalLower === 'gold') {
    const purity = purityDisplay(specs.metalPurity);
    const colourRaw = String(specs.metalColour || '').trim().toLowerCase();
    if (colourRaw === 'two-tone') {
      if (purity) parts.push(`${purity} two-tone gold`);
      else parts.push('Two-tone gold');
    } else {
      const colour = colourRaw;
      if (purity && colour) parts.push(`${purity} ${colour} gold`);
      else if (purity) parts.push(`${purity} gold`);
      else if (colour) parts.push(`${colour} gold`);
      else parts.push('Gold');
    }
  } else if (metalLower === 'platinum') {
    parts.push('Platinum');
  } else if (metalLower === 'silver') {
    parts.push('Silver');
  } else if (metalLower === 'other') {
    const other = String(specs.otherMetalDetails || '').trim();
    parts.push(other || 'Custom metal');
  } else {
    parts.push('Select a metal finish');
  }

  const stones = String(specs.stonesIncluded || 'no').trim().toLowerCase();
  if (includeDiamonds && stones === 'yes') {
    const stoneType = String(specs.stoneType || '').trim();
    if (stoneType) parts.push(stoneType.toLowerCase());
    else parts.push('with diamonds');
    const bracket = String(specs.stoneQualityBracket || '').trim();
    if (bracket && stoneType.toLowerCase().includes('natural')) {
      parts.push(bracket.toLowerCase());
    }
  } else if (includeDiamonds && stones === 'no' && metal) {
    parts.push('no stones');
  }

  return parts.join(', ');
}

export function purityLabelForDisplay(stored) {
  return purityDisplay(stored) || stored;
}
