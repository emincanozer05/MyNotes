-- S&C Hub — Flashcard desteleri (AnkiPro tarzı "Kartlara çalış")
-- Her flashcard bir desteye (deck) aittir; boş bırakılırsa "Genel".
-- Kullanıcı istediği desteyi seçip (due olsun olmasın) tüm kartlara çalışabilir.

alter table public.flashcards
  add column if not exists deck text not null default 'Genel';

-- Deste + tekrar tarihine göre hızlı sorgular için indeks
create index if not exists flashcards_user_deck_idx
  on public.flashcards (user_id, deck);
