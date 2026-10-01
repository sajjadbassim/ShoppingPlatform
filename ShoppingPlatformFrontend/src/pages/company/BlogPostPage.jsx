// src/pages/company/BlogPostPage.jsx
import { useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Calendar, Clock, ArrowRight } from 'lucide-react'
import Breadcrumb from '../../components/common/Breadcrumb'
import { NotFoundPage } from '../errors'
import { blogPosts } from './companyContent'
import { formatPostDate, PostCover } from './BlogPage'

const BlogPostPage = () => {
  const { slug } = useParams()
  const post = blogPosts.find((p) => p.slug === slug)

  useEffect(() => {
    if (post) document.title = `${post.title} | واسط التجارية`
  }, [post])

  if (!post) return <NotFoundPage />

  const related = blogPosts.filter((p) => p.slug !== post.slug && p.category === post.category).slice(0, 2)
  const more = related.length ? related : blogPosts.filter((p) => p.slug !== post.slug).slice(0, 2)

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container-main py-6">
        <Breadcrumb
          items={[{ label: 'المدونة', path: '/blog' }, { label: post.title }]}
          className="mb-6"
        />

        <article className="card p-6 lg:p-10 max-w-3xl mx-auto">
          <PostCover category={post.category} size="lg" />

          <span className="inline-block text-sm font-medium text-primary mt-6">{post.category}</span>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 mt-2">{post.title}</h1>
          <div className="flex items-center gap-4 text-sm text-gray-500 mt-3 pb-6 border-b border-gray-100">
            <span className="flex items-center gap-1"><Calendar size={15} />{formatPostDate(post.date)}</span>
            <span className="flex items-center gap-1"><Clock size={15} />{post.readTime} دقائق قراءة</span>
          </div>

          <div className="space-y-4 mt-6">
            {post.content.map((block, i) =>
              typeof block === 'string' ? (
                <p key={i} className="leading-8 text-gray-700">{block}</p>
              ) : (
                <ul key={i} className="space-y-3">
                  {block.list.map((item, j) => (
                    <li key={j} className="flex items-start gap-3 text-gray-700 leading-7">
                      <span className="w-6 h-6 rounded-full bg-primary-light text-primary text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                        {j + 1}
                      </span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              )
            )}
          </div>

          <Link to="/blog" className="inline-flex items-center gap-2 mt-8 font-medium">
            <ArrowRight size={18} />
            العودة إلى المدونة
          </Link>
        </article>

        {/* مقالات ذات صلة */}
        {more.length > 0 && (
          <section className="max-w-3xl mx-auto mt-10">
            <h2 className="text-xl font-bold text-gray-900 mb-4">مقالات قد تهمك</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {more.map((p) => (
                <Link key={p.slug} to={`/blog/${p.slug}`} className="card p-5 group text-gray-800 hover:text-gray-800">
                  <span className="text-xs font-medium text-primary">{p.category}</span>
                  <h3 className="font-bold text-gray-900 mt-1 group-hover:text-primary transition-colors">{p.title}</h3>
                  <p className="text-sm mt-2 line-clamp-2">{p.excerpt}</p>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}

export default BlogPostPage
