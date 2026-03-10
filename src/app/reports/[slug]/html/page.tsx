import { notFound, redirect } from 'next/navigation';
import { getReport } from '@/lib/reports';
import { createClient } from '@/lib/supabase/server';
import { promises as fs } from 'fs';
import path from 'path';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import Link from 'next/link';

export const dynamic = "force-dynamic";

export default async function ProtectedReportPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const report = getReport(slug);
  if (!report) notFound();

  // Supabase Auth Gate
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/auth/login?redirect=/reports/${slug}/html`);
  }

  // Read Markdown
  const mdPath = path.join(process.cwd(), 'data', 'reports-md', `${slug}.md`);
  let mdContent = '';
  try {
    mdContent = await fs.readFile(mdPath, 'utf-8');
  } catch (err) {
    mdContent = `*Markdown file not found for this report (${slug}.md).*`;
  }

  // Extract headings for TOC
  const headings: {level: number, text: string, id: string}[] = [];
  const lines = mdContent.split('\n');
  lines.forEach(line => {
    const match = line.match(/^(#{1,4})\s+(.*)$/);
    if (match) {
      const level = match[1].length;
      const text = match[2];
      const id = text.toLowerCase().replace(/[^\w]+/g, '-');
      headings.push({ level, text, id });
    }
  });

  return (
    <div className="min-h-screen bg-black text-gray-100 font-sans selection:bg-blue-500/30">
      
      {/* Top Nav */}
      <nav className="sticky top-0 z-50 border-b border-gray-800 bg-black/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex justify-between items-center">
          <Link href={`/reports/${slug}`} className="text-gray-400 hover:text-white font-medium text-sm transition-colors">
            ← Back to Report Details
          </Link>
          <div className="text-white font-bold text-sm truncate max-w-[50%]">
            {report.title}
          </div>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-blue-400 font-medium px-2 py-1 bg-blue-500/10 rounded border border-blue-500/20">
              Interactive HTML
            </span>
            <form action="/auth/signout" method="post">
              <button className="text-gray-400 hover:text-white transition-colors">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 flex flex-col lg:flex-row gap-12 relative">
        
        {/* Table of Contents - Sticky Sidebar */}
        <aside className="lg:w-1/4 shrink-0 hidden lg:block">
          <div className="sticky top-24 max-h-[calc(100vh-8rem)] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent pr-4">
            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4">Table of Contents</h3>
            <ul className="space-y-2.5 text-sm">
              {headings.map((h, i) => (
                <li key={i} style={{ paddingLeft: `${(h.level - 1) * 12}px` }}>
                  <a href={`#${h.id}`} className="text-gray-400 hover:text-white transition-colors block truncate hover:text-clip">
                    {h.text}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </aside>

        {/* Main Content */}
        <main className="lg:w-3/4 max-w-4xl">
          <div className="prose prose-invert prose-blue max-w-none 
            prose-headings:font-bold prose-headings:tracking-tight 
            prose-h1:text-4xl prose-h1:mb-8 prose-h1:text-white
            prose-h2:text-2xl prose-h2:mt-12 prose-h2:mb-4 prose-h2:text-blue-50
            prose-h3:text-xl prose-h3:mt-8 prose-h3:text-gray-200
            prose-p:text-gray-300 prose-p:leading-relaxed prose-p:mb-6
            prose-a:text-blue-400 prose-a:no-underline hover:prose-a:text-blue-300
            prose-strong:text-white prose-strong:font-semibold
            prose-ul:text-gray-300 prose-li:my-1
            prose-pre:bg-gray-900 prose-pre:border prose-pre:border-gray-800
            prose-code:text-blue-300 prose-code:bg-blue-900/20 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded">
            <ReactMarkdown 
              remarkPlugins={[remarkGfm]} 
              rehypePlugins={[rehypeRaw]}
              components={{
                h1: ({node, ...props}) => {
                  const id = props.children?.toString().toLowerCase().replace(/[^\w]+/g, '-') || '';
                  return <h1 id={id} className="scroll-mt-24" {...props} />;
                },
                h2: ({node, ...props}) => {
                  const id = props.children?.toString().toLowerCase().replace(/[^\w]+/g, '-') || '';
                  return <h2 id={id} className="scroll-mt-24 border-b border-gray-800 pb-2" {...props} />;
                },
                h3: ({node, ...props}) => {
                  const id = props.children?.toString().toLowerCase().replace(/[^\w]+/g, '-') || '';
                  return <h3 id={id} className="scroll-mt-24" {...props} />;
                }
              }}
            >
              {mdContent}
            </ReactMarkdown>
          </div>
        </main>
      </div>
    </div>
  );
}
