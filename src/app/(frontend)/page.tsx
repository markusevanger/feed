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
  _createdAt,
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
                <h2 className="font-mono text-sm">{post.title} <span className="text-xs text-accent-foreground ">collection posted @ {new Date(post._createdAt).toLocaleDateString()}</span></h2>
                {post.images?.map((image, index) => (
                  <div key={index}>
                    <Image className="rounded-lg shadow-xl" alt={"asd"} src={urlFor(image).url()} width={300} height={200}></Image>
                    {
                      image.asset ? (
                        (() => {
                          const createdAt = new Date(image.asset?._createdAt); // Declare the variable here
                          return (
                            <ul className="font-mono text-xs">
                              <li>shot on the  {createdAt.toLocaleDateString("no")} at {createdAt.toLocaleTimeString('no')}</li>
                              <li>location:  {image.asset.metadata?.location?.lng}, {image.asset.metadata?.location?.lat}</li>
                            </ul>
                          );
                        })()
                      ) :
                        <p>No metadata</p>
                    }
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