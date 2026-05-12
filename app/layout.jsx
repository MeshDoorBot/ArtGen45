import './globals.css';

export const metadata = {
  title: 'Mesh Art Generator',
  description: 'Generate Mesh DJ artwork for square posts and Instagram Stories.'
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
