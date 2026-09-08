# Salvage

A mobile-first local exchange for reusable renovation materials.

## Runtime
Vinext + React with Cloudflare D1 records, R2 photos, and Sites/ChatGPT sign-in. Profiles, listings, claims, and in-app notifications are persistent. Visitors must sign in and save a contractor or buyer profile before posting or claiming. Private deployments are owner-only until their access policy is changed.

## Photo analysis
Set OPENAI_API_KEY as a secret through Sites before deployment. OPENAI_VISION_MODEL defaults to gpt-4.1-mini. Photos are resized and converted to JPEG on-device, analyzed through a server-only structured-output request, then uploaded when published. Without a key, the form clearly offers manual entry; no analysis is simulated.

## Notifications
In-app alerts refresh every 15 seconds while open. Claims and contractor notifications are atomic. New-listing alerts are persisted for matching buyer category/radius preferences. Email, SMS, and background push delivery are not configured.

## Local development
Run pnpm dev. Generate schema changes with pnpm db:generate. Apply local migrations with Wrangler using the generated dist/server/wrangler.json configuration and --persist-to .wrangler/state. The local preview must be signed in using the Sites sign-in flow to make writes.

## Verification
pnpm exec tsc --noEmit
pnpm build
python scripts/test_claims.py

The focused claim test checks a single winner, no duplicate alerts, and exclusion from the available feed. Browser interaction QA has not been performed.

## Sample photos
Examples are clearly labeled and cannot be claimed. They are remote reference images, not real available inventory. Their sources retain their rights; reuse licensing has not been verified. Replace sample photos before a public commercial launch.

- Cabinets: https://www.solidconstructiondesign.com/blog/7-reasons-to-choose-oak-kitchen-cabinets-for-your-kitchen-renovations/
- Door: https://www.mongersofhingham.co.uk/categories/internal-doors
- Pendant: https://www.cultfurniture.com/products/franklin-pendant-light-brass
- Sink: https://www.leroymerlin.fr/produits/vasque-a-poser-rectangulaire-ceramique-58-5x37x12-5-cm-blanc-91022018.html
- Tile: https://www.cravendunnill.co.uk/ornata-cervera-200-x-200mm
- Dishwasher: https://www.did.ie/collections/freestanding-dishwashers/

Location search uses OpenStreetMap Nominatim. Map attribution is provided in its embedded view. Exact pickup addresses and contact details are restricted to the owner and claimant. Public coordinates are rounded.

Donation downloads are donor records with donor-estimated values, not nonprofit-issued acknowledgments or verified tax valuations.
