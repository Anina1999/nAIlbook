import { useId, useState } from 'react';
import type { ManicuristSummary } from '../../api/manicurists';
import ManicuristCarousel from '../manicurist-carousel/ManicuristCarousel';
import StudioMap from '../studio-map/StudioMap';
import styles from './SearchResults.module.css';

type SearchResultsProps = {
  /** At least one; the page shows the empty state instead. Kept stable while it is on screen. */
  manicurists: ManicuristSummary[];
  /** A new search is loading: the carousel's counter says «Зареждане…» and the cards stay. */
  loading: boolean;
  /** The look of a section title on the page (silver on `/`), for «Маникюристи» and «Студиа на картата». */
  titleClassName: string;
};

/**
 * The results of one search: the carousel and, under it, the map with a marker per
 * studio. It holds the active card (the first result at the start) and the card under
 * the pointer or the focus, so the card and its marker change together. Give it a `key`
 * from the search on screen, so a new search starts again at the first card and marker.
 */
export default function SearchResults({ manicurists, loading, titleClassName }: SearchResultsProps) {
  const resultsTitleId = useId();
  const mapTitleId = useId();
  const [activeId, setActiveId] = useState(manicurists[0].id);
  const [highlightedId, setHighlightedId] = useState<number | null>(null);

  return (
    <>
      <section aria-labelledby={resultsTitleId} className={styles.results}>
        <ManicuristCarousel
          heading={
            <h2 id={resultsTitleId} className={titleClassName}>
              Маникюристи
            </h2>
          }
          manicurists={manicurists}
          loading={loading}
          activeId={activeId}
          onActiveChange={setActiveId}
          onHighlight={setHighlightedId}
        />
      </section>

      <section aria-labelledby={mapTitleId} className={styles.mapSection}>
        <div className={styles.mapHead}>
          <h2 id={mapTitleId} className={titleClassName}>
            Студиа на картата
          </h2>
          <p className={styles.mapCopy}>Вижте къде е всяко студио.</p>
        </div>
        {/* The frame sets the map's height, radius and border; the map fills it. */}
        <div className={styles.mapFrame} aria-busy={loading}>
          <StudioMap
            markers={manicurists}
            activeId={activeId}
            highlightedId={highlightedId}
            onMarkerSelect={setActiveId}
            label="Карта на студиата"
          />
        </div>
      </section>
    </>
  );
}
