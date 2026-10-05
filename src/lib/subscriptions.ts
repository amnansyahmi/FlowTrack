export const subscriptions = [
  { name: "Netflix", logo: "netflix", description: "Movies & series" },
  {
    name: "YouTube Premium",
    logo: "youtube",
    description: "Ad-free video & music",
  },
  { name: "Spotify", logo: "spotify", description: "Music & podcasts" },
  { name: "Apple Music", logo: "apple", description: "Music streaming" },
  { name: "iCloud+", logo: "icloud", description: "Cloud storage" },
  { name: "Apple TV+", logo: "apple", description: "Movies & series" },
];
export function subscriptionLogo(name: string): string | undefined {
  const matched = subscriptions.find((service) =>
    name.toLowerCase().includes(service.name.toLowerCase()),
  );
  return matched ? `/logos/${matched.logo}.svg` : undefined;
}
