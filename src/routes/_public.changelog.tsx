/**
 * /changelog — guide update entries (added / removed / updated).
 */
import { createFileRoute } from '@tanstack/react-router'
import { prefetchPublicChangelog } from '../ssr.js'

export const Route = createFileRoute('/_public/changelog')({
  loader: () => prefetchPublicChangelog(),
  component: Changelog,
})

const CHANGE_LABEL: Record<string, string> = {
  added: 'Added',
  removed: 'Removed',
  updated: 'Updated',
}

function Changelog() {
  const { entries, changelogSubtitle } = Route.useLoaderData()
  return (
    <>
      <h1 className="font-display text-huge leading-huge mb-2">Changelog</h1>
      {changelogSubtitle && <p className="text-ink-light mb-8">{changelogSubtitle}</p>}
      <ul>
        {entries.map((entry) => {
          const changeType = entry.changeType ?? 'updated'
          return (
            <li key={entry.id} className="py-4 border-b border-ink/10">
              <div className="flex items-baseline gap-2 mb-1">
                <span className={`text-tiny font-medium ${changeType === 'removed' ? 'text-red-600' : 'text-blue'}`}>
                  {CHANGE_LABEL[changeType] ?? entry.changeType}
                </span>
                {entry.date && (
                  <span className="text-tiny text-ink-light">
                    {new Date(entry.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </span>
                )}
              </div>
              <h2 className="font-display text-xl leading-tight mb-1">{entry.title}</h2>
              {entry.description && <p className="text-normal text-ink-light">{entry.description}</p>}
              {entry.guide?.slug && (
                <a href={`/guides/${entry.guide.slug}`} className="text-tiny text-blue hover:opacity-80 transition-opacity">
                  {entry.guide.title ?? entry.guide.slug} →
                </a>
              )}
            </li>
          )
        })}
      </ul>
    </>
  )
}
