import { useId } from 'react';
import { Link, useSearchParams } from 'react-router';
import { searchManicurists, type ManicuristSummary } from '../../api/manicurists';
import ConnectionError from '../../components/connection-error/ConnectionError';
import ErrorMessage from '../../components/error-message/ErrorMessage';
import SearchForm, { type SearchValues } from '../../components/search-form/SearchForm';
import SearchResults from '../../components/search-results/SearchResults';
import { useAsync } from '../../hooks/useAsync';
import styles from './Home.module.css';

/** The results of one finished search, with the query they belong to. */
type SearchResult = SearchValues & {
  manicurists: ManicuristSummary[];
};

/** Says what the search did not find, with the query as the user typed it. */
function emptyMessage({ city, service }: SearchResult): string {
  if (city && service) return `Не са открити маникюристи в град „${city}“ с услуга „${service}“.`;
  if (city) return `Не са открити маникюристи в град „${city}“.`;
  if (service) return `Не са открити маникюристи с услуга „${service}“.`;
  return 'Все още няма маникюристи.';
}

export default function Home() {
  const resultsTitleId = useId();
  // The search lives in the URL, so reload, Back and a shared link show the same results.
  const [searchParams, setSearchParams] = useSearchParams();
  const city = (searchParams.get('city') ?? '').trim();
  const service = (searchParams.get('service') ?? '').trim();
  // The result carries its own query, so the empty message names the search on screen,
  // not a newer one that is still loading.
  const {
    data: result,
    error,
    loading,
    offline,
  } = useAsync<SearchResult>(
    (signal) =>
      searchManicurists({ city, service }, signal).then(({ manicurists }) => ({ city, service, manicurists })),
    [city, service],
  );

  // The server could not be reached: no hero and no search, only the message and
  // «Зареди отново», even over an earlier result.
  if (offline) return <ConnectionError />;

  const searchHandler = (values: SearchValues) => {
    const next = new URLSearchParams();
    // An empty field stays out of the URL.
    if (values.city.trim()) next.set('city', values.city.trim());
    if (values.service.trim()) next.set('service', values.service.trim());
    if (next.toString() !== searchParams.toString()) setSearchParams(next);
  };

  const sectionTitle = `${styles.silver} ${styles.sectionTitle}`;

  return (
    <div className={styles.page}>
      {/* No accessible name: named after the h1 («…във вашия град»), the region would also
          answer to the label «Град» of the city field. */}
      <section className={styles.hero}>
        <div className={styles.intro}>
          <p className={styles.badge}>Онлайн записване за маникюр</p>
          <h1 className={`${styles.silver} ${styles.title}`}>
            Намерете маникюрист във вашия град
          </h1>
          <p className={styles.copy}>
            Разгледайте студиата и услугите им, сравнете цени и запазете час онлайн.
          </p>
        </div>

        {error && <ErrorMessage message={error} />}
        {/* The key refills the inputs when the URL changes (Back, «Изчистете търсенето»). */}
        <SearchForm key={`${city}\n${service}`} initialValues={{ city, service }} onSearch={searchHandler} />
      </section>

      {result && result.manicurists.length > 0 ? (
        // The key from the search on screen: a new result starts again at the first card
        // and its marker, the view and the active card together.
        <SearchResults
          key={`${result.city}\n${result.service}`}
          manicurists={result.manicurists}
          loading={loading}
          titleClassName={sectionTitle}
        />
      ) : (
        <section aria-labelledby={resultsTitleId} className={styles.results}>
          <div className={styles.resultsHead}>
            <h2 id={resultsTitleId} className={sectionTitle}>
              Маникюристи
            </h2>
            {/* Always rendered with a fixed height, so «Зареждане…» does not move the content. */}
            <p role="status" className={styles.status}>
              {loading ? 'Зареждане…' : ''}
            </p>
          </div>
          {result && (
            <div className={styles.empty} aria-busy={loading}>
              <p>{emptyMessage(result)}</p>
              {(result.city || result.service) && (
                <Link to="/" className={styles.clearLink}>
                  Изчистете търсенето
                </Link>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
