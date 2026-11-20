import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface MarkdownViewProps {
  content: string;
  className?: string;
}

export const MarkdownView: React.FC<MarkdownViewProps> = ({ content, className = '' }) => {
  return (
    <div className={`prose-sm max-w-none text-xs leading-relaxed ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="text-base font-bold text-slate-900 mt-3 mb-1.5 pb-1 border-b border-slate-200">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-sm font-bold text-slate-900 mt-2.5 mb-1 pb-0.5 border-b border-slate-150">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-xs font-bold text-slate-800 mt-2 mb-1 flex items-center gap-1.5">
              {children}
            </h3>
          ),
          h4: ({ children }) => (
            <h4 className="text-xs font-semibold text-slate-700 mt-1.5 mb-0.5">
              {children}
            </h4>
          ),
          p: ({ children }) => (
            <p className="my-1.5 text-slate-700 leading-relaxed font-sans first:mt-0 last:mb-0">
              {children}
            </p>
          ),
          strong: ({ children }) => (
            <strong className="font-semibold text-slate-900">{children}</strong>
          ),
          em: ({ children }) => (
            <em className="italic text-slate-800">{children}</em>
          ),
          ul: ({ children }) => (
            <ul className="list-disc list-outside pl-4 my-2 space-y-1 text-slate-700">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-outside pl-4 my-2 space-y-1 text-slate-700">
              {children}
            </ol>
          ),
          li: ({ children }) => (
            <li className="leading-relaxed pl-0.5">{children}</li>
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto my-3 rounded-lg border border-slate-200 shadow-2xs">
              <table className="w-full text-left border-collapse text-xs">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-slate-100/90 text-slate-800 font-semibold border-b border-slate-200">
              {children}
            </thead>
          ),
          tbody: ({ children }) => (
            <tbody className="divide-y divide-slate-200 bg-white">
              {children}
            </tbody>
          ),
          tr: ({ children }) => (
            <tr className="hover:bg-slate-50/70 transition-colors">
              {children}
            </tr>
          ),
          th: ({ children }) => (
            <th className="px-3 py-2 text-[11px] font-semibold text-slate-700 uppercase tracking-wider">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-3 py-2 text-slate-700 align-top">
              {children}
            </td>
          ),
          code: ({ children, className }) => {
            const isInline = !className || !className.includes('language-');
            if (isInline) {
              return (
                <code className="bg-slate-100 text-primary-700 px-1.5 py-0.5 rounded text-[11px] font-mono border border-slate-200/80 mx-0.5">
                  {children}
                </code>
              );
            }
            return (
              <div className="my-2 rounded-lg bg-slate-900 p-3 text-slate-100 font-mono text-[11px] overflow-x-auto border border-slate-800 shadow-xs">
                <code>{children}</code>
              </div>
            );
          },
          pre: ({ children }) => (
            <pre className="my-2 rounded-lg bg-slate-900 text-slate-100 font-mono text-[11px] overflow-x-auto shadow-xs border border-slate-800">
              {children}
            </pre>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-primary-500 bg-primary-50/40 pl-3 py-1 my-2 rounded-r italic text-slate-600">
              {children}
            </blockquote>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="text-primary-600 hover:text-primary-700 underline font-medium"
            >
              {children}
            </a>
          ),
          hr: () => <hr className="my-3 border-slate-200" />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};
