import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useApp } from '@/store/store';
import { groupResults, highlightSegments, searchAll, SEARCH_TYPE_TONES, type SearchResult } from '@/lib/search';
import { useDebounced } from '@/lib/hooks';
import { PageBody, PageHeader } from '@/components/layout/PageHeader';
import { Badge, Button, Card, EmptyState, Kbd, SectionCard, TONE_CLASSES } from '@/components/ui/primitives';
import { SearchInput } from '@/components/ui/form';
import { IconChevronRight, IconSearch } from '@/components/icons';

const SUGGESTIONS = ['Kubernetes', 'Docker', 'Terraform', 'Jenkins', 'AWS', 'revision'];

export function SearchPage() {
  const state = useApp();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const debounced = useDebounced(query, 180);

  const results = useMemo(() => searchAll(debounced, state, 60), [debounced, state]);
  const groups = useMemo(() => groupResults(results), [results]);
  const total = results.length;

  return (
    <PageBody>
      <PageHeader
        eyebrow="Global search"
        title="Search everything"
        description="One query across courses, topics, tasks, projects, notes and study sessions."
        actions={
          <Button variant="secondary" onClick={() => navigate('/')}>
            Back to dashboard
          </Button>
        }
      />

      <Card className="flex flex-wrap items-center gap-3">
        <SearchInput
          autoFocus
          value={query}
          onChange={setQuery}
          placeholder="Search for “Kubernetes”, a task title, a tag, a command…"
          className="min-w-64 flex-1"
        />
        <span className="flex items-center gap-2 text-[11.5px] text-fg-subtle">
          <Kbd>ctrl</Kbd>
          <Kbd>K</Kbd>
          <span>opens the command palette from anywhere</span>
        </span>
      </Card>

      {!query.trim() ? (
        <Card>
          <EmptyState
            icon={<IconSearch size={20} />}
            title="Start typing to search"
            description="Search runs entirely in your browser against the data stored in IndexedDB — nothing is uploaded."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                {SUGGESTIONS.map((suggestion) => (
                  <Button key={suggestion} variant="secondary" size="sm" onClick={() => setQuery(suggestion)}>
                    {suggestion}
                  </Button>
                ))}
              </div>
            }
          />
        </Card>
      ) : null}

      {query.trim() ? (
        total ? (
          <>
            <p className="text-[12.5px] text-fg-muted">
              <strong className="text-fg">{total}</strong> result(s) for “{query}” across {groups.length} collection(s).
            </p>
            <div className="flex flex-col gap-4">
              {groups.map((group) => (
                <SectionCard
                  key={group.type}
                  title={group.label}
                  subtitle={`${group.items.length} match(es)`}
                  bodyClassName="px-4 py-3"
                >
                  <ul className="flex flex-col gap-1.5">
                    {group.items.map((result) => (
                      <li key={`${result.type}-${result.id}`}>
                        <Link
                          to={result.route}
                          className="flex items-center gap-3 rounded-xl border border-line bg-surface-2 px-3.5 py-2.5 transition-colors hover:border-line-strong"
                        >
                          <span
                            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${TONE_CLASSES[SEARCH_TYPE_TONES[result.type]].soft}`}
                          >
                            <ResultGlyph type={result.type} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[13px] font-medium text-fg">
                              {highlightSegments(result.title, debounced).map((segment, index) =>
                                segment.match ? (
                                  <mark key={index} className="rounded bg-brand/25 px-0.5 text-fg">
                                    {segment.text}
                                  </mark>
                                ) : (
                                  <span key={index}>{segment.text}</span>
                                ),
                              )}
                            </span>
                            <span className="block truncate text-[11.5px] text-fg-subtle">{result.subtitle}</span>
                          </span>
                          <Badge tone={SEARCH_TYPE_TONES[result.type]}>{result.type}</Badge>
                          <IconChevronRight size={14} className="shrink-0 text-fg-subtle" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </SectionCard>
              ))}
            </div>
          </>
        ) : (
          <Card>
            <EmptyState
              icon={<IconSearch size={20} />}
              title={`No results for “${query}”`}
              description="Try a shorter term, or check the spelling. Search covers titles, descriptions, tags, notes and task text."
              action={
                <div className="flex flex-wrap justify-center gap-2">
                  {SUGGESTIONS.map((suggestion) => (
                    <Button key={suggestion} variant="secondary" size="sm" onClick={() => setQuery(suggestion)}>
                      {suggestion}
                    </Button>
                  ))}
                </div>
              }
            />
          </Card>
        )
      ) : null}
    </PageBody>
  );
}

function ResultGlyph({ type }: { type: SearchResult['type'] }) {
  const glyphs: Record<SearchResult['type'], string> = {
    course: '▤',
    topic: '◈',
    task: '☑',
    project: '⬢',
    note: '✎',
    session: '◷',
  };
  return <span className="text-[13px]">{glyphs[type]}</span>;
}
