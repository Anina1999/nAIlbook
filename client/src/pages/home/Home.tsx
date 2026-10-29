import { Link, useSearchParams } from 'react-router';
import { searchManicurists, type ManicuristSummary } from '../../api/manicurists';
import ErrorMessage from '../../components/error-message/ErrorMessage';
import ManicuristCard from '../../components/manicurist-card/ManicuristCard';
import SearchForm, { type SearchValues } from '../../components/search-form/SearchForm';
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
  } = useAsync<SearchResult>(
    (signal) =>
      searchManicurists({ city, service }, signal).then(({ manicurists }) => ({ city, service, manicurists })),
    [city, service],
  );

  const searchHandler = (values: SearchValues) => {
    const next = new URLSearchParams();
    // An empty field stays out of the URL.
    if (values.city.trim()) next.set('city', values.city.trim());
    if (values.service.trim()) next.set('service', values.service.trim());
    if (next.toString() !== searchParams.toString()) setSearchParams(next);
  };

  return (
    <div className={styles.page}>
      <div>
        <h1 className={styles.title}>nAIlbook</h1>
        <p className={styles.lead}>Намерете маникюрист във вашия град и запазете час онлайн.</p>
      </div>

      <section className={styles.search}>
        {error && <ErrorMessage message={error} />}
        {/* The key refills the inputs when the URL changes (Back, «Изчистете търсенето»). */}
        <SearchForm key={`${city}\n${service}`} initialValues={{ city, service }} onSearch={searchHandler} />

        {/* Always rendered with a fixed height, so «Зареждане…» does not move the results. */}
        <p role="status" className={styles.status}>
          {loading ? 'Зареждане…' : ''}
        </p>

        {result &&
          (result.manicurists.length > 0 ? (
            <ul className={styles.results} aria-busy={loading}>
              {result.manicurists.map((manicurist) => (
                <li key={manicurist.id} className={styles.result}>
                  <ManicuristCard manicurist={manicurist} />
                </li>
              ))}
            </ul>
          ) : (
            <div className={styles.empty}>
              <p>{emptyMessage(result)}</p>
              {(result.city || result.service) && (
                <Link to="/" className={styles.clearLink}>
                  Изчистете търсенето
                </Link>
              )}
            </div>
          ))}
      </section>
    </div>
  );
}
