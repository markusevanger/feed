import FeedMedia from "@/components/FeedMedia";
import { FeedContainer } from "@/components/FeedContainer";
import Header from "@/components/Header";
import IntroAnimation from "@/components/IntroAnimation";
import MobiusStripLogo from "@/components/MobiusStripLogo";
import PostFilterBadges from "@/components/PostFilterBadges";
import { packIntoRows } from "@/lib/grid-layout";
import { client } from "@/sanity/lib/client";
import { isSameDay } from "date-fns";
import Link from "next/link";
import type { Post, SelfHostedMedia } from "../../../sanity.types";

// Tag for on-demand revalidation via webhook
export const revalidate = false; // Only revalidate when triggered

// Extend types with _key from array items
type PostMediaItem = { _key: string } & SelfHostedMedia;

interface PostWithMedia extends Omit<Post, 'media'> {
  media: PostMediaItem[] | null;
}

const POST_QUERY = `*[_type == "post"] | order(_createdAt desc) {
  _id,
  _type,
  _createdAt,
  _updatedAt,
  _rev,
  title,
  slug,
  media[]{
    _key,
    _type,
    mediaType,
    url,
    width,
    height,
    aspectRatio,
    lqip,
    alt,
    exif,
    location,
    mimeType,
    orientation
  }
}`;

export default async function Page() {
  const posts = await client.fetch<PostWithMedia[]>(POST_QUERY);

  return (
    <IntroAnimation>
      <Header />
      <section className="relative z-0 container mx-auto px-4 sm:px-6 mt-20 mb-10 min-h-screen">

        <PostFilterBadges posts={posts.map((p) => ({ _id: p._id, title: p.title, slug: p.slug?.current ?? null }))} position="fixed" />

        <FeedContainer>
          <div className="flex flex-col gap-8 lg:px-40">
            {posts && posts.length > 0 ? (
              posts.map((post) => (
                <div key={post._id} id={`post-${post.slug?.current}`} className="scroll-mt-4">
                  <div className="flex justify-between border-b border-border mb-2 pb-1 font-array">
                    <h2 className="font-mono text-sm">{post.title}</h2>
                    <div className="flex items-center gap-1">
                      {isSameDay(new Date(post._createdAt), new Date()) &&
                        <span className="relative flex items-center justify-center size-2">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-300 opacity-75"></span>
                          <span className="relative inline-flex size-2 rounded-full bg-sky-400"></span>
                        </span>}
                      <p className="text-xs text-accent-foreground font-mono ">posted @ {new Date(post._createdAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="flex flex-col lg:grid lg:grid-cols-3 gap-4 py-4 lg:p-8">
                    {post.media && post.media.length > 0 ? (
                      packIntoRows(post.media).flatMap((row) =>
                        row.items.map((item) => (
                          <FeedMedia
                            key={item.media._key}
                            media={item.media}
                            colSpan={item.colSpan as 1 | 2 | 3}
                          />
                        ))
                      )
                    ) : (
                      <p className="text-muted-foreground font-mono col-span-3 text-center py-8">no media :(</p>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="flex justify-center items-center py-20">
                <p className="text-muted-foreground font-mono">no items :(</p>
              </div>
            )}
          </div>
        </FeedContainer>
      </section>
      <footer className="flex flex-col items-center gap-4 py-10 pb-10">
        <PostFilterBadges posts={posts.map((p) => ({ _id: p._id, title: p.title, slug: p.slug?.current ?? null }))} position="footer" />
        <MobiusStripLogo className="h-16 w-auto" />
        <div className="text-sm px-4 py-1 bg-muted rounded-full opacity-60 hover:opacity-100 transition-opacity">
          <p>
            utvikling og reising av <Link className="underline" href="https://markusevanger.no">markusevanger.no</Link>
          </p>
        </div>
      </footer>
    </IntroAnimation>
  );
}
