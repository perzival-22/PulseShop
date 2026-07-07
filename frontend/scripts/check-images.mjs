// Verifies candidate Unsplash photo IDs return HTTP 200 (plan §6 requirement).
const ids = [
  "photo-1521572163474-6864f9cf17ab",
  "photo-1576566588028-4147f3842f27",
  "photo-1583743814966-8936f5b7be1a",
  "photo-1434389677669-e08b4cac3105",
  "photo-1541099649105-f69ad21f3246",
  "photo-1594633312681-425c7b97ccd1",
  "photo-1624378439575-d8705ad7ae80",
  "photo-1591047139829-d91aecb6caea",
  "photo-1595777457583-95e059d581b8",
  "photo-1572804013309-59a88b7e92f1",
  "photo-1515372039744-b8f02a3ae446",
  "photo-1496747611176-843222e1e57c",
  "photo-1523275335684-37898b6baf30",
  "photo-1553062407-98eeb64c6a62",
  "photo-1511499767150-a48a237f0083",
  "photo-1590874103328-eac38a683ce7",
  "photo-1584917865442-de89df76afd3",
  "photo-1551028719-00167b16eac5",
  "photo-1596755094514-f87e34085b2c",
  "photo-1620799140408-edc6dcb6d633",
  "photo-1494790108377-be9c29b29330",
  "photo-1544441893-675973e31985",
  "photo-1560243563-062bfc001d68",
  "photo-1509631179647-0177331693ae",
];

for (const id of ids) {
  const url = `https://images.unsplash.com/${id}?w=800&q=80&auto=format&fit=crop`;
  try {
    const res = await fetch(url, { method: "HEAD" });
    console.log(`${res.status} ${id}`);
  } catch (e) {
    console.log(`ERR ${id} ${e.message}`);
  }
}
