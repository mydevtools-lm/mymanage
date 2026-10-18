//! The interface language, for the few texts Rust shows itself: the tray menu
//! and errors that reach the screen. The page sets it on every start and on
//! every switch (shell_set_language); everything else is translated there.

use std::sync::atomic::{AtomicBool, Ordering};

static HEBREW: AtomicBool = AtomicBool::new(false);

pub fn set_hebrew(on: bool) {
    HEBREW.store(on, Ordering::Relaxed);
}

/// The text in the current language: English, or Hebrew when the app is in Hebrew.
pub fn tr(en: &str, he: &str) -> String {
    if HEBREW.load(Ordering::Relaxed) {
        he
    } else {
        en
    }
    .to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn follows_the_language_the_page_sets() {
        set_hebrew(false);
        assert_eq!(tr("Open", "פתיחה"), "Open");
        set_hebrew(true);
        assert_eq!(tr("Open", "פתיחה"), "פתיחה");
        set_hebrew(false);
    }
}
