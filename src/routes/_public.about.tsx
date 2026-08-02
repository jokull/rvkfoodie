/**
 * /about — the about singleton (bio DAST) + the guide catalog.
 */
import { createFileRoute } from '@tanstack/react-router'
import { dastToHtml } from '../dast.js'
import { prefetchPublicAbout } from '../ssr.js'

export const Route = createFileRoute('/_public/about')({
  loader: () => prefetchPublicAbout(),
  component: About,
})

function About() {
  const { about, guides } = Route.useLoaderData()
  const bioHtml = about.bio ? dastToHtml(about.bio) : ''

  return (
    <>
      <h1 className="font-display text-huge leading-huge mb-6">{about.title ?? 'About'}</h1>
      {bioHtml && <div className="mb-12 prose-about prose-intro" dangerouslySetInnerHTML={{ __html: bioHtml }} />}
      {guides.length > 0 && (
        <section>
          <h2 className="font-display text-[1.75rem] leading-tight mb-4">The guides</h2>
          <ul className="space-y-3">
            {guides.map((g) => (
              <li key={g.id}>
                <a href={`/guides/${g.slug}`} className="text-blue hover:opacity-80 transition-opacity">
                  {g.title} →
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}
