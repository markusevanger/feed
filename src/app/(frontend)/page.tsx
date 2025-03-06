import FeedImage from "@/components/FeedImage";
import { ModeToggle } from "@/components/ui/ModeToggle";
import Windup from "@/components/Windup";
import { client } from "@/sanity/lib/client";
import { defineQuery } from "next-sanity";


export default async function Page() {

  const POST_QUERY = defineQuery(
    `*[_type == "post"] {
  _id,
  title,
  _createdAt,
  images[]{
    asset->{
      _id,
      url,
      _createdAt,
      metadata {
        dimensions,
        location,
        lqip,
        exif {
          DateTimeOriginal,
          LensMake,
          LensModel
        }
      }
    }
  }
}`
  );
  const posts = await client.fetch(POST_QUERY);
  console.log('Posts with EXIF:', JSON.stringify(posts, null, 2));

  return (
    <section className="container mx-auto px-2 my-10">
      <div className="flex w-full justify-between">
        <h1 className="font-mono font-bold text-sm"><Windup text="feed_" /></h1>
        <div>
          <ModeToggle />
        </div>
      </div>


      <div className="flex flex-col gap-4 justify-center items-center">

        {
          posts &&
          posts.map((post) => (
            <div key={post._id} className="">
              <div>
                <h2 className="font-mono text-sm">{post.title}</h2>
                <p className="text-xs text-accent-foreground font-mono ">collection posted @ {new Date(post._createdAt).toLocaleDateString()}</p>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {

                  post.images!!.map((image, index) => (
                    <FeedImage key={index} image={image} />
                  ))

                }
              </div>
              <div className="w-full flex justify-center items-center my-6">
                <div className="h-[250px] min-h-[1em] w-px self-stretch bg-gradient-to-tr from-transparent via-neutral-500 to-transparent opacity-25 dark:via-neutral-400"></div>
              </div>
            </div>
          ))
        }
      </div>
    </section>
  );

}


const isVertical = (height: number, width: number) => height > width


