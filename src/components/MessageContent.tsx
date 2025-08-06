import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Components } from 'react-markdown';

interface MessageContentProps {
  content: string;
  className?: string;
}

export default function MessageContent({ content, className = '' }: MessageContentProps) {
  const components: Components = {
        // Custom rendering for legal-specific elements
        p: ({ children }) => <p className="mb-3 leading-relaxed">{children}</p>,
        
        // Headers for legal sections
        h1: ({ children }) => <h1 className="text-xl font-bold mt-4 mb-3 text-gray-900">{children}</h1>,
        h2: ({ children }) => <h2 className="text-lg font-semibold mt-3 mb-2 text-gray-900">{children}</h2>,
        h3: ({ children }) => <h3 className="text-base font-semibold mt-2 mb-2 text-gray-800">{children}</h3>,
        
        // Lists for procedures and requirements
        ul: ({ children }) => <ul className="list-disc list-inside mb-3 space-y-1">{children}</ul>,
        ol: ({ children }) => <ol className="list-decimal list-inside mb-3 space-y-1">{children}</ol>,
        li: ({ children }) => <li className="ml-2">{children}</li>,
        
        // Code for legal articles and references
        code: ({ children, ...props }) => {
          const isInline = !props.node?.position;
          if (isInline) {
            return <code className="bg-gray-100 px-1 py-0.5 rounded text-sm font-mono text-legal-700">{children}</code>;
          }
          return (
            <pre className="bg-gray-50 p-3 rounded-md overflow-x-auto mb-3">
              <code className="text-sm font-mono">{children}</code>
            </pre>
          );
        },
        
        // Blockquotes for legal citations
        blockquote: ({ children }) => (
          <blockquote className="border-l-4 border-legal-500 pl-4 py-2 mb-3 bg-legal-50 italic">
            {children}
          </blockquote>
        ),
        
        // Tables for comparisons
        table: ({ children }) => (
          <div className="overflow-x-auto mb-3">
            <table className="min-w-full divide-y divide-gray-200">{children}</table>
          </div>
        ),
        thead: ({ children }) => <thead className="bg-gray-50">{children}</thead>,
        tbody: ({ children }) => <tbody className="bg-white divide-y divide-gray-200">{children}</tbody>,
        tr: ({ children }) => <tr>{children}</tr>,
        th: ({ children }) => (
          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
            {children}
          </th>
        ),
        td: ({ children }) => (
          <td className="px-3 py-2 text-sm text-gray-900">{children}</td>
        ),
        
        // Links
        a: ({ href, children }) => (
          <a 
            href={href} 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-legal-600 hover:text-legal-700 underline"
          >
            {children}
          </a>
        ),
        
        // Strong text for important points
        strong: ({ children }) => <strong className="font-semibold text-gray-900">{children}</strong>,
        
        // Emphasis
        em: ({ children }) => <em className="italic">{children}</em>,
        
        // Horizontal rules
        hr: () => <hr className="my-4 border-gray-200" />,
  };
  
  return (
    <div className={`markdown-content ${className}`}>
      <ReactMarkdown 
        remarkPlugins={[remarkGfm]}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}