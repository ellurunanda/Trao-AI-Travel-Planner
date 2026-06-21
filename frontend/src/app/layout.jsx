import './globals.css';

export const metadata = {
  title: 'Trao AI Travel Planner',
  description: 'Multi-user AI travel itinerary planner'
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
