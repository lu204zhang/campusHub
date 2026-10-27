import { useEffect, useState } from 'react';

import {
  CampusHubApiError,
  fetchResources,
  type Resource,
  type ResourceType,
} from '../api/campushubApi';
import styles from './ResourceList.module.css';

const RESOURCE_TYPE_FILTERS: ReadonlyArray<ResourceType | 'ALL'> = [
  'ALL',
  'ROOM',
  'EQUIPMENT',
  'LAB',
];

interface ResourceListProps {
  tenantId: string;
  onBook: (resource: Resource) => void;
}

function ResourceList({ tenantId, onBook }: ResourceListProps): React.JSX.Element {
  const [typeFilter, setTypeFilter] = useState<ResourceType | 'ALL'>('ALL');
  const [resources, setResources] = useState<Resource[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;

    async function loadResources(): Promise<void> {
      setIsLoading(true);
      setError(undefined);
      try {
        const result = await fetchResources(
          tenantId,
          typeFilter === 'ALL' ? undefined : typeFilter,
        );
        if (!cancelled) {
          setResources(result);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof CampusHubApiError
              ? loadError.message
              : 'Failed to load resources.',
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadResources();

    return (): void => {
      cancelled = true;
    };
  }, [tenantId, typeFilter]);

  return (
    <section>
      <div className={styles.filters}>
        {RESOURCE_TYPE_FILTERS.map((option) => (
          <button
            key={option}
            type="button"
            className={option === typeFilter ? styles.filterButtonActive : styles.filterButton}
            onClick={() => setTypeFilter(option)}
          >
            {option}
          </button>
        ))}
      </div>

      {isLoading && <p className={styles.status}>Loading resources…</p>}
      {error !== undefined && <p className={styles.errorText}>{error}</p>}
      {!isLoading && error === undefined && resources.length === 0 && (
        <p className={styles.empty}>No resources match this filter.</p>
      )}

      <div className={styles.grid}>
        {resources.map((resource) => (
          <article key={resource.id} className={styles.card}>
            <div className={styles.cardHeader}>
              <h3 className={styles.cardName}>{resource.name}</h3>
              <span className={styles.cardType}>{resource.type}</span>
            </div>
            <p className={styles.cardLocation}>{resource.location}</p>
            <span
              className={resource.isAvailable ? styles.badgeAvailable : styles.badgeUnavailable}
            >
              {resource.isAvailable ? 'Available' : 'Unavailable'}
            </span>
            <button
              type="button"
              className={styles.bookButton}
              disabled={!resource.isAvailable}
              onClick={() => onBook(resource)}
            >
              Book
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}

export { ResourceList };
