"use client";

import { useEffect, useState } from "react";
import useAnalytics from "../hooks/useAnalytics";
import { trackingEventsMap } from "../constants";

const CAROUSEL_IMAGES = [
  { src: "/by-asset-type.png", alt: "Assets by Type" },
  { src: "/by-sector.png", alt: "Assets by Sector" },
  { src: "/by-broker.png", alt: "Assets by Broker" },
];

interface OneviewInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function OneviewInfoModal({ isOpen, onClose }: OneviewInfoModalProps) {
  const { trackClick } = useAnalytics();
  const [activeSlide, setActiveSlide] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(true);
  const [shouldRender, setShouldRender] = useState(isOpen);
  const [isClosing, setIsClosing] = useState(false);
  const totalSlides = CAROUSEL_IMAGES.length;

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      setIsClosing(false);
      return;
    }

    if (shouldRender) {
      setIsClosing(true);
      const timeout = setTimeout(() => {
        setShouldRender(false);
        setIsClosing(false);
      }, 280);
      return () => clearTimeout(timeout);
    }
  }, [isOpen, shouldRender]);

  useEffect(() => {
    if (!isOpen) {
      setActiveSlide(0);
      setIsTransitioning(true);
      return;
    }

    const interval = setInterval(() => {
      setActiveSlide((prev) => prev + 1);
      setIsTransitioning(true);
    }, 3000);

    return () => clearInterval(interval);
  }, [isOpen]);

  useEffect(() => {
    if (activeSlide === totalSlides) {
      const timeout = setTimeout(() => {
        setIsTransitioning(false);
        setActiveSlide(0);
      }, 600);
      return () => clearTimeout(timeout);
    }
  }, [activeSlide, totalSlides]);

  function handleClose() {
    trackClick({
      buttonName: trackingEventsMap.documentsPage.CLICK_ONEVIEW_MODAL_CLOSE,
      pageName: trackingEventsMap.documentsPage.PAGE,
    });
    onClose();
  }

  function handleCreateOneview() {
    trackClick({
      buttonName: trackingEventsMap.documentsPage.CLICK_ONEVIEW_MODAL_CREATE,
      pageName: trackingEventsMap.documentsPage.PAGE,
    });
    onClose();
  }

  if (!shouldRender) return null;

  return (
    <div className={`modal-overlay${isClosing ? " is-closing" : ""}`} onClick={handleClose}>
      <div className={`oneview-info-modal${isClosing ? " is-closing" : ""}`} onClick={(e) => e.stopPropagation()}>
        <button className="oneview-info-close" onClick={handleClose} aria-label="Close modal">
          <CloseIcon />
        </button>

        <div className="oneview-info-header">
          <div className="oneview-info-badge">
            <SparkleIcon />
            See what Meridian can do for you
          </div>
          <h2 className="oneview-info-title">
            The most comprehensive view of your entire portfolio. Anywhere in the world!
          </h2>
          <p className="oneview-info-description">
            Meridian brings all your investments together in one secure dashboard so you can see the complete picture and make smarter decisions.
          </p>
        </div>

        <div className="oneview-info-content">
          <img src="/graph-card.png" alt="Portfolio Graph" className="oneview-info-image" />
          <div className="oneview-info-carousel">
            <div
              className="oneview-info-carousel-track"
              style={{
                transform: `translateX(-${activeSlide * 100}%)`,
                transition: isTransitioning ? "transform 0.6s cubic-bezier(0.45, 0, 0.15, 1)" : "none",
              }}
            >
              {CAROUSEL_IMAGES.map((image) => (
                <img
                  key={image.src}
                  src={image.src}
                  alt={image.alt}
                  className="oneview-info-carousel-slide"
                />
              ))}
              <img
                src={CAROUSEL_IMAGES[0].src}
                alt={CAROUSEL_IMAGES[0].alt}
                className="oneview-info-carousel-slide"
              />
            </div>
          </div>
        </div>

        <div className="oneview-info-features">
          <div className="oneview-info-feature">
            <div className="oneview-info-feature-icon">
              <img src="/shield.png" alt="" width={48} height={48} />
            </div>
            <div className="oneview-info-feature-content">
              <h4 className="oneview-info-feature-title">All your investments. One place</h4>
              <p className="oneview-info-feature-text">
                Stocks, ETF, Mutual funds, Bonds, and more across brokers and countries
              </p>
            </div>
          </div>

          <div className="oneview-info-feature">
            <div className="oneview-info-feature-icon">
              <img src="/shield.png" alt="" width={48} height={48} />
            </div>
            <div className="oneview-info-feature-content">
              <h4 className="oneview-info-feature-title">Complete clarity and performance</h4>
              <p className="oneview-info-feature-text">
                Track accurate value, return, and allocation with powerful insights
              </p>
            </div>
          </div>

          <div className="oneview-info-feature">
            <div className="oneview-info-feature-icon">
              <img src="/shield.png" alt="" width={48} height={48} />
            </div>
            <div className="oneview-info-feature-content">
              <h4 className="oneview-info-feature-title">100% Safe, Secure, and Private</h4>
              <p className="oneview-info-feature-text">
                Bank-grade encryption. We never share or sell your financial data
              </p>
            </div>
          </div>
        </div>

        <button className="oneview-info-cta" onClick={handleCreateOneview} type="button">
          Create my unified view
        </button>
        <p className="oneview-info-time">Takes only 2 minutes</p>
      </div>
    </div>
  );
}

function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12.1429 5L5 12.1429M5 5L12.1429 12.1429" stroke="black" strokeOpacity="0.7" strokeWidth="1.42857" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function SparkleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
      <g clipPath="url(#clip0_sparkle)">
        <path d="M4.643 9.28488L5.20332 10.4055C5.39296 10.7848 5.48778 10.9744 5.61445 11.1388C5.72685 11.2846 5.85757 11.4153 6.00339 11.5277C6.16772 11.6544 6.35736 11.7492 6.73663 11.9388L7.85728 12.4992L6.73663 13.0595C6.35736 13.2491 6.16772 13.3439 6.00339 13.4706C5.85757 13.583 5.72685 13.7137 5.61445 13.8596C5.48778 14.0239 5.39296 14.2135 5.20332 14.5928L4.643 15.7134L4.08267 14.5928C3.89303 14.2135 3.79822 14.0239 3.67155 13.8596C3.55915 13.7137 3.42842 13.583 3.2826 13.4706C3.11827 13.3439 2.92864 13.2491 2.54937 13.0595L1.42871 12.4992L2.54937 11.9388C2.92864 11.7492 3.11827 11.6544 3.2826 11.5277C3.42842 11.4153 3.55915 11.2846 3.67155 11.1388C3.79822 10.9744 3.89303 10.7848 4.08267 10.4055L4.643 9.28488Z" stroke="#7F4E0B" strokeWidth="1.42857" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M10.7144 1.42773L11.5563 3.6166C11.7577 4.14034 11.8585 4.40221 12.0151 4.62248C12.1539 4.8177 12.3245 4.98827 12.5197 5.12708C12.74 5.28371 13.0018 5.38442 13.5256 5.58586L15.7144 6.42773L13.5256 7.26961C13.0018 7.47104 12.74 7.57176 12.5197 7.72839C12.3245 7.8672 12.1539 8.03777 12.0151 8.23299C11.8585 8.45326 11.7577 8.71513 11.5563 9.23886L10.7144 11.4277L9.87255 9.23886C9.67112 8.71513 9.5704 8.45326 9.41377 8.23299C9.27496 8.03777 9.10439 7.8672 8.90917 7.72839C8.6889 7.57176 8.42703 7.47104 7.9033 7.26961L5.71443 6.42773L7.9033 5.58586C8.42703 5.38442 8.6889 5.28371 8.90917 5.12708C9.10439 4.98827 9.27496 4.8177 9.41377 4.62248C9.5704 4.40221 9.67112 4.14034 9.87255 3.6166L10.7144 1.42773Z" stroke="#7F4E0B" strokeWidth="1.42857" strokeLinecap="round" strokeLinejoin="round"/>
      </g>
      <defs>
        <clipPath id="clip0_sparkle">
          <rect width="17.1429" height="17.1429" fill="white"/>
        </clipPath>
      </defs>
    </svg>
  );
}

function CheckShieldIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <g clipPath="url(#clip0_8319_55492)">
        <rect width="48" height="48" rx="9.6" fill="#EFF6F1"/>
        <path d="M34.5719 14.6675L24.0496 11.072H24.0164C23.9832 11.072 23.9513 11.072 23.9513 11.0391H23.8862H23.8211H23.756H23.6909C23.6577 11.0391 23.6577 11.0391 23.6257 11.072H23.5926L13.0039 14.6675C12.6771 14.7649 12.4805 15.056 12.4805 15.4129V23.124C12.4805 28.5986 15.7152 33.6533 20.7153 35.9542C21.6306 36.3757 22.6109 36.6996 23.5913 36.9262C23.6564 36.9262 23.6896 36.9591 23.7547 36.9591C23.8198 36.9591 23.853 36.9591 23.9181 36.9262C24.8985 36.6996 25.8789 36.3757 26.7941 35.9542C31.7944 33.6218 35.029 28.6002 35.029 23.124V15.4129C35.0953 15.0889 34.8655 14.7979 34.5719 14.6675ZM33.5264 23.124C33.5264 28.0168 30.6504 32.4864 26.1736 34.5608C25.3899 34.9177 24.6048 35.2088 23.7878 35.3708C22.9708 35.1759 22.1538 34.9177 21.402 34.5608C16.9252 32.5195 14.0491 28.0155 14.0491 23.124V15.9634L23.7879 12.6261L33.5266 15.9634L33.5264 23.124Z" fill="#38B789"/>
        <path d="M20.0642 23.8385C19.7706 23.5475 19.2804 23.5475 18.9536 23.8385C18.66 24.1296 18.66 24.6156 18.9536 24.9396L21.5347 27.4985C21.6649 27.6276 21.8947 27.725 22.09 27.725C22.2866 27.725 22.4819 27.6276 22.6453 27.4985L28.6259 21.5693C28.9195 21.2782 28.9195 20.7923 28.6259 20.4683C28.3323 20.1772 27.8421 20.1772 27.5153 20.4683L22.0899 25.847L20.0642 23.8385Z" fill="#38B789"/>
        <g opacity="0.37">
          <g filter="url(#filter0_f_8319_55492)" style={{ mixBlendMode: 'color-burn' }}>
            <ellipse cx="34.7725" cy="44.1579" rx="22.8604" ry="24.111" fill="#E1A22E"/>
          </g>
          <g filter="url(#filter1_f_8319_55492)" style={{ mixBlendMode: 'color-burn' }}>
            <ellipse cx="13.2746" cy="24.1256" rx="22.8742" ry="24.1256" fill="#31B67F"/>
          </g>
          <g filter="url(#filter2_f_8319_55492)" style={{ mixBlendMode: 'color-burn' }}>
            <ellipse cx="32.263" cy="52.048" rx="22.888" ry="25.9621" fill="#96B3E0"/>
          </g>
        </g>
      </g>
      <defs>
        <filter id="filter0_f_8319_55492" x="-2.63933" y="5.49544" width="74.8236" height="77.3255" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
          <feFlood floodOpacity="0" result="BackgroundImageFix"/>
          <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape"/>
          <feGaussianBlur stdDeviation="7.27572" result="effect1_foregroundBlur_8319_55492"/>
        </filter>
        <filter id="filter1_f_8319_55492" x="-24.151" y="-14.5514" width="74.8509" height="77.3548" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
          <feFlood floodOpacity="0" result="BackgroundImageFix"/>
          <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape"/>
          <feGaussianBlur stdDeviation="7.27572" result="effect1_foregroundBlur_8319_55492"/>
        </filter>
        <filter id="filter2_f_8319_55492" x="-5.17644" y="11.5345" width="74.8792" height="81.0267" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
          <feFlood floodOpacity="0" result="BackgroundImageFix"/>
          <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape"/>
          <feGaussianBlur stdDeviation="7.27572" result="effect1_foregroundBlur_8319_55492"/>
        </filter>
        <clipPath id="clip0_8319_55492">
          <rect width="48" height="48" rx="9.6" fill="white"/>
        </clipPath>
      </defs>
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path d="M5 12H19M19 12L12 5M19 12L12 19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
