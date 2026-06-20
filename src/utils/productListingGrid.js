/** Single-line grid separators for shop/similar product listing (no doubled outer borders). */
export function productListingGridBorderClasses(desktopGridCols) {
  const mdFirstCol =
    desktopGridCols === 2
      ? 'md:[&>article:nth-child(2n+1)]:border-l lg:[&>article:nth-child(2n+1)]:border-l-0'
      : desktopGridCols === 4
        ? 'md:[&>article:nth-child(4n+1)]:border-l lg:[&>article:nth-child(4n+1)]:border-l-0'
        : 'md:[&>article:nth-child(3n+1)]:border-l lg:[&>article:nth-child(3n+1)]:border-l-0';

  return [
    '[&>article]:border-r [&>article]:border-b [&>article]:border-pale/70',
    'max-md:[&>article:nth-child(2n+1)]:border-l',
    mdFirstCol,
  ].join(' ');
}

/** Product detail “Similar Products” strip — 2 cols mobile, 4 cols desktop. */
export function similarProductsStripBorderClasses() {
  return [
    '[&>article]:border-pale/70',
    // Single-side internal verticals so neighboring cards don't create doubled lines.
    'max-md:[&>article:nth-child(2n+1)]:border-r',
    'md:[&>article:nth-child(4n+1)]:border-r',
    'md:[&>article:nth-child(4n+2)]:border-r',
    'md:[&>article:nth-child(4n+3)]:border-r',
    // Internal horizontals only — outer box uses the section wrapper border.
    'max-md:[&>article:not(:nth-last-child(-n+2))]:border-b',
    'md:[&>article:not(:nth-last-child(-n+4))]:border-b',
  ].join(' ');
}
