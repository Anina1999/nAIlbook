import { formatPrice } from '../../utils/format';
import styles from './Price.module.css';

type PriceProps = {
  priceCents: number;
};

/**
 * A price with its cents raised and smaller: 25<sup>,00</sup> €.
 * The text content stays «25,00 €», so screen readers read the whole price.
 */
export default function Price({ priceCents }: PriceProps) {
  const text = formatPrice(priceCents);
  const comma = text.indexOf(',');
  // formatPrice always gives «<euros>,<two digits> €».
  const euros = text.slice(0, comma);
  const cents = text.slice(comma, comma + 3);
  const currency = text.slice(comma + 3);

  return (
    <span className={styles.price}>
      {euros}
      <span className={styles.cents}>{cents}</span>
      {currency}
    </span>
  );
}
