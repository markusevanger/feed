import FeedMedia from "@/components/FeedMedia";
import { ModeToggle } from "@/components/ui/ModeToggle";
import Windup from "@/components/Windup";
import { client } from "@/sanity/lib/client";
import { defineQuery } from "next-sanity";
import { isSameDay } from "date-fns";
import Link from "next/link";

export default async function Page() {

  const POST_QUERY = defineQuery(
    `*[_type == "post"] | order(_createdAt desc) {
  _id,
  title,
  _createdAt,
  images[]{
    asset->{
      _id,
      url,
      _createdAt,
      altText,
      metadata {
        dimensions,
        "hasLocation": defined(location),
        "location": select(
          defined(location) => location,
          null
        ),
        "exif": select(
          defined(exif) => {
            "dateTime": exif.DateTimeOriginal,
            "lensMake": exif.LensMake,
            "lensModel": exif.LensModel
          },
          null
        ),
        lqip
      }
    }
  },
  videos[]{
    orientation,
    asset->{
      _id,
      url,
      _createdAt,
      mimeType
    }
  }
}`
  );

  const posts = await client.fetch(POST_QUERY);

  return (
    <>
      <section className="container mx-auto px-2 my-10">
        <div className="flex flex-col lg:flex-row w-full items-center justify-between mb-10">
          <h1 className="flex font-array text-2xl"><Windup text="feed" /><span className="animate-pulse">_</span></h1>
          <div className="flex items-center gap-2">
            <h2 className="text-sm text-muted-foreground">🚧 under construction & work in progress 🏗️</h2>
            <ModeToggle />
          </div>
        </div>

        <div className="flex flex-col gap-8 lg:px-40">
          {posts &&
            posts.map((post) => (
              <div key={post._id} className="">
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
                <div className="flex flex-col lg:grid lg:grid-cols-3 gap-4 p-8">
                  {post.images?.map((image, index: number) => (
                    <FeedMedia key={`image-${index}`} media={{ type: 'image', data: image }} />
                  ))}
                  {post.videos?.map((video, index: number) => (
                    <FeedMedia key={`video-${index}`} media={{ type: 'video', data: video }} />
                  ))}
                </div>
              </div>
            ))}
        </div>
      </section>
      <footer className="flex justify-center py-10 items-center ">
        <div className="text-sm px-4 py-1 bg-muted rounded-full opacity-60 hover:opacity-100 transition-opacity">
          <p>
            utviklet av <Link className="underline" href="https://markusevanger.no">markusevanger.no</Link> 🌐
          </p>
        </div>
      </footer>
    </>
  );
}

