import MetadataDialog from "@/components/MetadataDialog";
import { Badge } from "@/components/ui/badge";
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
        lqip,
        exif {
          LensMake,
          LensModel,
          Flash
        }

      }
    }
  }
}`
  );
  const posts = await client.fetch(POST_QUERY);

  return (
    <section className="container mx-auto px-2 my-10">
      <div className="flex w-full justify-between">
        <h1 className="font-mono font-bold text-sm">feed_</h1>
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
                <p className="text-xs text-accent-foreground ">collection posted @ {new Date(post._createdAt).toLocaleDateString()}</p>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {

                  post.images!!.map((image, index) => (
                    <div
                      key={index}
                      className={""}
                    >
                      <Image className="rounded-lg shadow-xl w-ful h-fulll" alt={"asd"} placeholder="blur" blurDataURL={image.asset?.metadata?.lqip!!} src={urlFor(image).url()} width={300} height={300}></Image>
                      <div className="justify-between w-full flex">

                        {
                          (() => {
                            const createdAt = new Date(image.asset?._createdAt!!);
                            return <Badge variant={"outline"} className="font-mono">{createdAt.toLocaleDateString("no")} at {createdAt.toLocaleTimeString('no')}</Badge>;
                          })()
                        }
                        {
                          image.asset && image.asset.metadata &&
                          <MetadataDialog imageAsset={image.asset} />
                        }
                      </div>
                    </div>
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