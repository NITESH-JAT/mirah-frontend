import React, { useState, useEffect } from 'react';

const slides = [
  {
    image: "https://images.unsplash.com/photo-1605100804763-247f67b3557e?auto=format&fit=crop&q=80&w=800",
    title: "Custom Jewellery, Crafted Just for You",
    desc: "Upload your jewelry idea, describe your vision, and let skilled jewelers transform it into a timeless piece crafted just for you"
  },
  {
    image: "https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?auto=format&fit=crop&q=80&w=800",
    title: "Connect with Skilled Artisans",
    desc: "Direct access to master makers who bring centuries of tradition to your modern designs."
  },
  {
    image: "https://images.unsplash.com/photo-1598560912015-f3a73656719a?auto=format&fit=crop&q=80&w=800",
    title: "Transparent Crafting Process",
    desc: "Track every step of your jewelry creation, from initial sketch to final polish."
  }
];

export default function CarouselPanel() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setActive(prev => (prev + 1) % slides.length);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="hidden lg:flex w-1/2 bg-white h-full p-8 items-center justify-center">
      <div className="max-w-md w-full text-center">
        <div className="relative h-80 mb-12 flex items-center justify-center">
           <img 
            src={slides[active].image} 
            className="max-h-full object-contain transition-opacity duration-700"
            alt="Jewellery" 
          />
        </div>
        <h2 className="auth-heading text-3xl font-semibold mb-4 px-4 leading-tight">
          {slides[active].title}
        </h2>
        <p className="text-gray-500 text-sm leading-relaxed px-6 mb-10">
          {slides[active].desc}
        </p>
        <div className="flex justify-center gap-2">
          {slides.map((_, i) => (
            <button 
              key={i}
              onClick={() => setActive(i)}
              className={`h-2 rounded-full transition-all duration-300 ${active === i ? 'w-6 bg-primary-dark' : 'w-2 bg-gray-300'}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}