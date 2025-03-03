import { client } from "@/sanity/lib/client";
import { urlFor } from "@/sanity/lib/image";
import { defineQuery } from "next-sanity";
import Image from 'next/image'

export default async function Page() {

  const POST_QUERY = defineQuery(
    `
    *[_type == "post"]`
  );
  const posts = await client.fetch(POST_QUERY);

  return (
    <section className="container mx-auto my-10">
      <h1 className="text-xl font-bold">Feed</h1>

      <div className="flex flex-col gap-4">
        
        {posts.map((post) => (
          <div key={post._id}>
            <h2>{post.title}</h2>
            {post.images?.map((image, index) => (
              <Image key={index} className="rounded-lg" src={urlFor(image).url()} alt="asd" width={150} height={200} />
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}