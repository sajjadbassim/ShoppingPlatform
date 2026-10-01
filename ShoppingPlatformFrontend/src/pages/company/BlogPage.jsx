// src/pages/company/BlogPage.jsx
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Calendar, Clock, ArrowLeft, ShoppingBag, Megaphone, Store } from 'lucide-react'
import Breadcrumb from '../../components/common/Breadcrumb'
import { blogPosts, blogCategories } from './companyContent'

export const formatPostDate = (date) =>
  new Date(date).toLocaleDateString('ar-IQ', { year: 'numeric', month: 'long', day: 'numeric' })

// غلاف ملوّن لكل تصنيف بدلاً من الصور
export const categoryStyles = {
  'نصائح التسوق': { icon: ShoppingBag, bg: 'bg-primary-light', color: 'text-primary' },
  'أخبار المنصة': { icon: Megaphone, bg: 'bg-success-light', color: 'text-success-dark' },
  'للبائعين': { icon: Store, bg: 'bg-warning-light', color: 'text-warning-dark' },
}

export const PostCover = ({ category, size = 'md' }) => {
  const style = categoryStyles[category] || categoryStyles['نصائح التسوق']
  const Icon = style.icon
  return (
    <div className={`${style.bg} ${style.color} flex items-center justify-center ${size === 'lg' ? 'h-56 rounded-xl' : 'h-40'}`}>
      <Icon size={size === 'lg' ? 64 : 48} strokeWidth={1.5} />
    </div>
  )
}

const BlogPage = () => {
  const [category, setCategory] = useState('الكل')

  useEffect(() => {
    document.title = 'المدونة | واسط التجارية'
  }, [])

  const posts = category === 'الكل' ? blogPosts : blogPosts.filter((p) => p.category === category)

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <div className="container-main py-6">
          <Breadcrumb items={[{ label: 'الشركة', path: '/about' }, { label: 'المدونة' }]} className="mb-6" />
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">المدونة</h1>
          <p className="text-gray-500 mt-1">نصائح التسوق وآخر أخبار المنصة ومقالات مفيدة للبائعين</p>

          <div className="flex gap-2 mt-6 overflow-x-auto">
            {blogCategories.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                  category === c ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="container-main py-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {posts.map((post) => (
            <Link
              key={post.slug}
              to={`/blog/${post.slug}`}
              className="card overflow-hidden flex flex-col group text-gray-800 hover:text-gray-800"
            >
              <PostCover category={post.category} />
              <div className="p-5 flex flex-col flex-1">
                <span className="text-xs font-medium text-primary">{post.category}</span>
                <h2 className="text-lg font-bold text-gray-900 mt-2 group-hover:text-primary transition-colors">
                  {post.title}
                </h2>
                <p className="text-sm mt-2 leading-6 flex-1">{post.excerpt}</p>
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100 text-xs text-gray-500">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1"><Calendar size={13} />{formatPostDate(post.date)}</span>
                    <span className="flex items-center gap-1"><Clock size={13} />{post.readTime} دقائق</span>
                  </div>
                  <ArrowLeft size={16} className="text-primary transition-transform group-hover:-translate-x-1" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}

export default BlogPage
