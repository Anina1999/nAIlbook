import { useRef, useState, type ReactNode } from 'react';
import { A11y, Keyboard } from 'swiper/modules';
import { Swiper, SwiperSlide } from 'swiper/react';
import type { Swiper as SwiperInstance } from 'swiper/types';
import 'swiper/css';
import 'swiper/css/a11y';
import type { ManicuristSummary } from '../../api/manicurists';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import ManicuristCard from '../manicurist-card/ManicuristCard';
import styles from './ManicuristCarousel.module.css';

type ManicuristCarouselProps = {
  /** The section's heading, shown above the counter. */
  heading: ReactNode;
  /** At least one; the page shows the empty state instead of an empty carousel. */
  manicurists: ManicuristSummary[];
  /** A new search is loading: the counter line says «Зареждане…» and the cards stay. */
  loading: boolean;
};

/** 1 card on a phone, 2 from `sm`, 3 from `lg` (Tailwind's breakpoints). */
const BREAKPOINTS = {
  640: { slidesPerView: 2 },
  1024: { slidesPerView: 3 },
};

const A11Y_MESSAGES = {
  prevSlideMessage: 'Предишни',
  nextSlideMessage: 'Следващи',
  firstSlideMessage: 'Това е първият маникюрист',
  lastSlideMessage: 'Това е последният маникюрист',
  paginationBulletMessage: 'Към маникюрист {{index}}',
  slideLabelMessage: '{{index}} от {{slidesLength}}',
};

function ArrowIcon({ direction }: { direction: 'left' | 'right' }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={direction === 'left' ? 'M15 18l-6-6 6-6' : 'M9 18l6-6-6-6'} />
    </svg>
  );
}

/** «Показана 1 от 6» for one card in view, «Показани 1–3 от 6» for more (as in the design). */
function counterText(first: number, last: number, total: number): string {
  return first === last ? `Показана ${first + 1} от ${total}` : `Показани ${first + 1}–${last + 1} от ${total}`;
}

/**
 * The search results as a Swiper carousel with its own arrows, a counter and dots.
 * The arrows go round (`rewind`), so they are never disabled; the keyboard's arrow
 * keys move it too. Give it a `key` from the search, so a new search starts at the
 * first card.
 */
export default function ManicuristCarousel({ heading, manicurists, loading }: ManicuristCarouselProps) {
  const reducedMotion = useReducedMotion();
  const swiperRef = useRef<SwiperInstance | null>(null);
  const [view, setView] = useState({ activeIndex: 0, perView: 1 });

  const syncHandler = (swiper: SwiperInstance) => {
    const perView = typeof swiper.params.slidesPerView === 'number' ? swiper.params.slidesPerView : 1;
    setView({ activeIndex: swiper.activeIndex, perView });
  };

  const swiperHandler = (swiper: SwiperInstance) => {
    swiperRef.current = swiper;
    syncHandler(swiper);
  };

  // Swiper's activeIndex can pass the last view (rewinding back from the first card,
  // focusing a card with Tab); the cards in view always end at the last one.
  const total = manicurists.length;
  const perView = Math.min(view.perView, total);
  const first = Math.min(view.activeIndex, total - perView);
  const last = first + perView - 1;

  return (
    <div className={styles.carousel}>
      <div className={styles.head}>
        <div className={styles.titleBlock}>
          {heading}
          {/* Always one line high, so the cards do not move. */}
          <p role="status" className={styles.counter}>
            {loading ? 'Зареждане…' : counterText(first, last, total)}
          </p>
        </div>
      </div>

      {/* The previous results stay while a new search loads. The arrows sit on the outer
          edges of the first and the last card in view, so every card keeps its full width.
          They come before the cards, so Tab reaches them first. */}
      <div className={styles.viewport} aria-busy={loading}>
        <button
          type="button"
          aria-label="Предишни"
          className={styles.prev}
          onClick={() => swiperRef.current?.slidePrev()}
        >
          <ArrowIcon direction="left" />
        </button>
        <button
          type="button"
          aria-label="Следващи"
          className={styles.next}
          onClick={() => swiperRef.current?.slideNext()}
        >
          <ArrowIcon direction="right" />
        </button>
        <Swiper
          modules={[A11y, Keyboard]}
          a11y={A11Y_MESSAGES}
          keyboard={{ enabled: true }}
          rewind
          slidesPerView={1}
          spaceBetween={12}
          breakpoints={BREAKPOINTS}
          speed={reducedMotion ? 0 : 300}
          onSwiper={swiperHandler}
          onSlideChange={syncHandler}
          onBreakpoint={syncHandler}
        >
          {manicurists.map((manicurist, index) => (
            <SwiperSlide key={manicurist.id}>
              <ManicuristCard manicurist={manicurist} active={index === first} />
            </SwiperSlide>
          ))}
        </Swiper>
      </div>

      {/* Decoration: the counter says the same in words. */}
      <div className={styles.dots} aria-hidden="true">
        {manicurists.map((manicurist, index) => (
          <span
            key={manicurist.id}
            className={[
              styles.dot,
              index >= first && index <= last && styles.dotShown,
              index === first && styles.dotActive,
            ]
              .filter(Boolean)
              .join(' ')}
          />
        ))}
      </div>
    </div>
  );
}
