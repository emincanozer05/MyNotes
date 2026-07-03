-- ---------------------------------------------------------------------------
-- Flashcard decks
-- ---------------------------------------------------------------------------
-- Adds an optional deck name so cards can be grouped and studied AnkiPro-style
-- ("study a deck": drill through every card in it, not only the ones due).
-- Existing rows fall back to the "Genel" (general) deck.
-- ---------------------------------------------------------------------------

alter table public.flashcards
  add column if not exists deck text not null default 'Genel';

create index if not exists flashcards_deck_idx
  on public.flashcards (user_id, deck);
