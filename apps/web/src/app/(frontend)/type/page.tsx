'use client'

import { useState } from 'react'

export default function TypePage() {
  const [text, setText] = useState('')

  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <div className="relative w-full max-w-4xl">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          autoFocus
          className="absolute inset-0 w-full h-full opacity-0 cursor-default"
          placeholder=""
        />
        <div className="font-array text-[12rem] leading-none text-center select-none pointer-events-none">
          {text || <span className="opacity-20">Type...</span>}
        </div>
      </div>
    </div>
  )
}
