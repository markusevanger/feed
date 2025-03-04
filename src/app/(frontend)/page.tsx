import { ModeToggle } from "@/components/ui/ModeToggle";
import { client } from "@/sanity/lib/client";
import { urlFor } from "@/sanity/lib/image";
import { defineQuery } from "next-sanity";
import Image from 'next/image'


export default async function Page() {

  const POST_QUERY = defineQuery(
    `*[_type == "post"] {
  _id,
  title,
  _publishedAt,
  images[]{
    asset->{
      _id,
      url,
      _createdAt,
      metadata {
        dimensions,
        location,
        exif,

      }
    }
  }
}`
  );
  const posts = await client.fetch(POST_QUERY);

  console.log(posts)

  return (
    <section className="container mx-auto my-10">
      <div className="flex w-full justify-between">
        <h1 className="font-mono font-bold">feed.markusevanger.no</h1>
        <div>
          <ModeToggle />
        </div>
      </div>


      <div className="flex flex-col gap-4 justify-center items-center">

        {



          posts ?


            posts.map((post) => (
              <div key={post._id} className="sx">
                <h2 className="font-mono text-sm">{post.title} <span className="font-xs">collection posted @ {post._publishedAt}</span></h2>
                {post.images?.map((image, index) => (
                  <div key={index}>
                    <Image className="rounded-lg shadow-xl" alt={"asd"} src={urlFor(image).url()} width={300} height={200}></Image>
                    <div className="font-mono text-xs">{image.asset?._createdAt}</div>
                  </div>
                ))}
              </div>
            ))

            :

            <div>Loading</div>


        }
      </div>
    </section>
  );
}