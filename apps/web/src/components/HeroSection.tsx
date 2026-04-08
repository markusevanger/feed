import { PortableText } from "@portabletext/react";
import { Badge } from "@/components/ui/badge";
import type { PortableTextBlock } from "@portabletext/types";

interface Post {
  _id: string;
  title: string | null;
  slug: string | null;
}

interface HeroSectionProps {
  heroContent?: unknown[];
  posts: Post[];
}

export default function HeroSection({ heroContent, posts }: HeroSectionProps) {
  return (
    <section className="container mx-auto px-4 sm:px-6 py-6 lg:py-10">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 lg:px-40">
        {/* Left: Portable Text content */}
        <div className="prose prose-invert max-w-none font-array">
          {heroContent && heroContent.length > 0 ? (
            <PortableText
              value={heroContent as PortableTextBlock[]}
              components={{
                block: {
                  h1: ({ children }) => (
                    <h1 className="text-4xl lg:text-5xl font-bold tracking-tight mb-4 text-white">{children}</h1>
                  ),
                  h2: ({ children }) => (
                    <h2 className="text-2xl lg:text-3xl font-bold tracking-tight mb-3 text-white">{children}</h2>
                  ),
                  h3: ({ children }) => (
                    <h3 className="text-xl lg:text-2xl font-bold mb-2 text-white">{children}</h3>
                  ),
                  normal: ({ children }) => (
                    <p className="text-base text-white/80 leading-relaxed mb-4">{children}</p>
                  ),
                },
                marks: {
                  strong: ({ children }) => <strong className="font-bold text-white">{children}</strong>,
                  em: ({ children }) => <em>{children}</em>,
                  code: ({ children }) => (
                    <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono">{children}</code>
                  ),
                  link: ({ children, value }) => (
                    <a
                      href={value?.href}
                      className="underline underline-offset-4 hover:text-foreground transition-colors"
                      target={value?.href?.startsWith("http") ? "_blank" : undefined}
                      rel={value?.href?.startsWith("http") ? "noopener noreferrer" : undefined}
                    >
                      {children}
                    </a>
                  ),
                },
              }}
            />
          ) : (
            <p className="text-muted-foreground">No content yet.</p>
          )}
        </div>

        {/* Right: Post list badges */}
        <div className="flex flex-col gap-2">
          <p className="text-xs text-muted-foreground font-mono mb-2 uppercase tracking-wider">Posts</p>
          <div className="flex flex-wrap gap-2">
            {posts.map((post) => (
              <a key={post._id} href={`#post-${post.slug}`}>
                <Badge
                  variant="outline"
                  className="cursor-pointer rounded-full px-3 py-1 text-xs hover:bg-primary hover:text-primary-foreground transition-colors"
                >
                  {post.title || "Untitled"}
                </Badge>
              </a>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
