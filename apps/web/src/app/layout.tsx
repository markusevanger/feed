



import localFont from 'next/font/local'
import { BreakpointIndicator } from "@/components/BreakpointIndicator";
import "./globals.css";



const arrayFont = localFont({
  src: [
    {
      path: './fonts/Array-Regular.woff2',
      style: 'normal',
      weight: '400',
    },
    {
      path: './fonts/Array-Bold.woff2',
      style: 'bold',
      weight: '700',
    }
  ],
  display: 'swap',
  variable: '--font-array',
})


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {



  return (
    <html lang="en" className="dark">
      <body className={`${arrayFont.variable} antialiased`}>
        {children}
        <BreakpointIndicator />
      </body>
    </html>
  );
}
