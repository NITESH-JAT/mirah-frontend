import React, { useState, useEffect, useRef } from 'react';
import gsap from 'gsap';
import img1 from '../assets/mirah_img1.png';
import img2 from '../assets/mirah_img2.png';
import img3 from '../assets/mirah_img3.png';

const slides = [
  {
    image: img1,
    title: "Custom Jewellery, Crafted Just for You",
    desc: "Upload your jewelry idea, describe your vision, and let skilled jewelers transform it into a timeless piece crafted just for you"
  },
  {
    image: img2,
    title: "Connect with Skilled Artisans",
    desc: "Direct access to master makers who bring centuries of tradition to your modern designs."
  },
  {
    image: img3,
    title: "Transparent Crafting Process",
    desc: "Track every step of your jewelry creation, from initial sketch to final polish."
  }
];

export default function CarouselPanel() {
  const [active, setActive] = useState(0);
  const contentRef = useRef(null);
  const imageRef = useRef(null);

  const handleFade = (index) => {
    if (index === active) return;
    
    gsap.to([contentRef.current, imageRef.current], {
      opacity: 0,
      y: 10,
      duration: 0.3,
      onComplete: () => {
        setActive(index);
        gsap.to([contentRef.current, imageRef.current], {
          opacity: 1,
          y: 0,
          duration: 0.5,
          ease: "power2.out"
        });
      }
    });
  }; 

  useEffect(() => {
    const timer = setInterval(() => {
      const next = (active + 1) % slides.length;
      handleFade(next);
    }, 5000);
    return () => clearInterval(timer);
  }, [active]);

  return (

    <div className="w-full h-full bg-white rounded-[25px] shadow-sm flex items-center justify-center px-8 py-10 overflow-hidden relative">
      <div className="w-full h-full flex flex-col items-center justify-center">
        

        <div className="relative w-full flex-1 flex items-center justify-center min-h-0 mb-8">
          <img 
            ref={imageRef}
            src={slides[active].image} 
            className="max-h-full max-w-full w-auto h-auto object-contain drop-shadow-xl"
            alt="Jewellery Display" 
          />
        </div>
        

        <div ref={contentRef} className="text-center max-w-[400px] mt-auto shrink-0">
          <h2 className="font-serif text-[26px] leading-tight font-bold mb-4 text-primary-dark">
            {slides[active].title}
          </h2>
          <p className="font-sans text-gray-400 text-sm leading-relaxed px-2 mb-10">
            {slides[active].desc}
          </p>
        </div>


        <div className="flex justify-center gap-2 shrink-0">
          {slides.map((_, i) => (
            <button 
              key={i}
              onClick={() => handleFade(i)}
              className={`h-1.5 rounded-full transition-all duration-300 ${active === i ? 'w-8 bg-primary-dark' : 'w-1.5 bg-gray-200'}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}