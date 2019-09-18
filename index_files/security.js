/* Ensure that the parent is the website. */
try {
    if (self.location.href != top.location.href) {
        top.location = self.location;
    }
} catch ( ex ) {
    top.location = self.location;
}