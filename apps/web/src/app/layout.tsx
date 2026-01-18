



import localFont from 'next/font/local'
import { ThemeProvider } from "@/components/theme-provider";
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
    <html lang="en" suppressHydrationWarning>

      <body
        className={`${arrayFont.variable} antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
        >
          {children}
          <BreakpointIndicator />
        </ThemeProvider>
      </body>

    </html >
  );
}
