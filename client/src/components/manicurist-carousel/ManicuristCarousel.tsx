import { useEffect, useRef, useState, type ReactNode } from 'react';
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
  /** The active card, owned by the parent; the carousel brings it into view when it is not. */
  activeId: number;
  /** A click on a card, or the user moving the carousel (the first card in view), reports the new active card. */
  onActiveChange: (id: number) => void;
  /** Hover or focus on a card reports its id, and `null` when it ends. */
  onHighlight: (id: number | null) => void;
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

/** The cards in view per Swiper's current breakpoint: 1, 2 or 3. */
function slidesPerView(swiper: SwiperInstance): number {
  return typeof swiper.params.slidesPerView === 'number' ? swiper.params.slidesPerView : 1;
}

/**
 * The index of the first card in view. Swiper's activeIndex can pass the last view
 * (rewinding back from the first card, focusing a card with Tab); the cards in view
 * always end at the last one.
 */
function firstInView(activeIndex: number, perView: number, total: number): number {
  return Math.max(0, Math.min(activeIndex, total - Math.min(perView, total)));
}

/**
 * The search results as a Swiper carousel with its own arrows, a counter and dots.
 * The arrows go round (`rewind`), so they are never disabled; the keyboard's arrow
 * keys move it too. The counter and the dots follow the cards in view. The active card
 * is `activeId` from the parent: the user moving the carousel makes the first card in
 * view active, and one effect brings the active card into view when it is not.
 */
export default function ManicuristCarousel({
  heading,
  manicurists,
  loading,
  activeId,
  onActiveChange,
  onHighlight,
}: ManicuristCarouselProps) {
  const reducedMotion = useReducedMotion();
  const swiperRef = useRef<SwiperInstance | null>(null);
  // True while the carousel moves on its own (its own slideTo, or Swiper's handling of a
  // resize): the slide change then follows the active card instead of choosing one.
  // Swiper emits slideChange synchronously inside slideTo whatever its `runCallbacks`
  // argument says, so a flag around the call is the only way to tell the moves apart.
  const ownMoveRef = useRef(false);
  const [view, setView] = useState({ activeIndex: 0, perView: 1 });
  const speed = reducedMotion ? 0 : 300;

  const syncHandler = (swiper: SwiperInstance) => {
    setView({ activeIndex: swiper.activeIndex, perView: slidesPerView(swiper) });
  };

  const swiperHandler = (swiper: SwiperInstance) => {
    swiperRef.current = swiper;
    syncHandler(swiper);
  };

  // The arrows, the arrow keys, a swipe or Tab to a card out of view: the first card in view becomes active.
  const slideChangeHandler = (swiper: SwiperInstance) => {
    syncHandler(swiper);
    if (ownMoveRef.current) return;
    const index = firstInView(swiper.activeIndex, slidesPerView(swiper), manicurists.length);
    onActiveChange(manicurists[index].id);
  };

  // On a breakpoint change the active card stays; the effect below brings it back into view.
  const beforeResizeHandler = () => {
    ownMoveRef.current = true;
  };
  const resizeHandler = () => {
    ownMoveRef.current = false;
  };

  const total = manicurists.length;
  const perView = Math.min(view.perView, total);
  const first = firstInView(view.activeIndex, perView, total);
  const last = first + perView - 1;
  const activeIndex = manicurists.findIndex((manicurist) => manicurist.id === activeId);

  // Keeps the active card in view: when it is before the cards in view, it becomes the
  // first; when it is after them, the last. A card already in view does not move the
  // carousel. One path for a click on a card and for a click on its marker.
  useEffect(() => {
    const swiper = swiperRef.current;
    if (!swiper || activeIndex < 0) return;
    let target: number;
    if (activeIndex < first) target = activeIndex;
    else if (activeIndex > last) target = activeIndex - perView + 1;
    else return;
    ownMoveRef.current = true;
    try {
      swiper.slideTo(target, speed);
    } finally {
      ownMoveRef.current = false;
    }
  }, [activeIndex, first, last, perView, speed]);

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
          speed={speed}
          onSwiper={swiperHandler}
          onSlideChange={slideChangeHandler}
          onBreakpoint={syncHandler}
          onBeforeResize={beforeResizeHandler}
          onResize={resizeHandler}
        >
          {manicurists.map((manicurist) => (
            <SwiperSlide key={manicurist.id}>
              <ManicuristCard
                manicurist={manicurist}
                active={manicurist.id === activeId}
                onActivate={onActiveChange}
                onHighlight={onHighlight}
              />
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
