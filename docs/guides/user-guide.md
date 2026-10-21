# User guide

## Sign in

Use Email/Password or Google sign-in. Email/Password accounts must verify their email before the API accepts their token. Access shown in the dashboard depends on the role and geography assigned by the owner.

## Explore locations

1. Open the countries map.
2. Select a country to open its country map and hierarchy overview.
3. Select a mapped area or a hierarchy result to move one level deeper.
4. Continue through the country-defined levels until the required place is reached.

The navigation trail represents the current path. **Africa map** returns to the continent view; a country link returns to that country's map; a parent link returns to the exact parent location. Hover labels provide names where a map polygon is too small to hold readable text.

Not every place has verified polygon geometry. When geometry is unavailable, the interface uses a hierarchy list/search view rather than inventing a shape or GPS position.

## Search and reference codes

Search accepts location names and permanent reference codes. Because names can repeat, confirm the displayed ancestor path before selecting a result.

Each location displays a code similar to:

```text
UG-L06-00615090C4C85EE68AF1B25044DBE620
```

Use this code in links, integrations, support requests, and stored relationships. A place can be renamed without changing its reference code.

## View leaders

Open a location's leadership section to see the current verified leader when one has been recorded. Authorized users can also see prior time-bounded assignments. “Not available” means no reviewed leader record exists; it is not an API failure.

## Time display

The country selector controls the display timezone. Times are stored and exchanged in UTC, then displayed using the country's configured IANA timezone in the form `HOUR:MINUTE:SECOND AM/PM TIMEZONE`. Countries spanning several zones expose the available choices.

## API access

Open **System settings > API Access** to view documentation and endpoints permitted for your account. Owners can create service clients from the **Service clients** section. Other users see only the API information allowed by their role and geographic assignments.

## If something looks wrong

- Refresh the current location once, then use the navigation trail rather than repeatedly clicking the map.
- Confirm the complete hierarchy path when two places share a name.
- Sign out and back in after an administrator changes your role.
- Report the request ID shown in an API error.
- Do not infer missing geometry, leadership, or source fields from nearby locations.
