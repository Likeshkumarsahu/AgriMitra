from types import SimpleNamespace

from app.services import ml_model, rag


def test_english_thanks_key_exists_and_works():
    assert rag._handle_greeting("thanks", "en") == rag.GREETINGS["en"]["thanks"]


def test_hindi_thanks_text_is_fixed():
    assert "धन्यवाद" in rag.GREETINGS["hi"]["thanks"]
    assert "अनुग्रहिता" not in rag.GREETINGS["hi"]["thanks"]


def test_long_question_with_thanks_is_not_swallowed():
    assert rag._handle_greeting("Thanks, but what is NPK?", "en") is None


def test_keyword_search_uses_whole_tokens(monkeypatch):
    monkeypatch.setattr(
        rag,
        "_load_keyword_index",
        lambda: [
            {"course": "Economics", "section": "Markets", "text": "The price of wheat is high."},
            {"course": "Crops", "section": "Cereals", "text": "Rice is a staple cereal crop."},
        ],
    )

    hits = rag.keyword_search("rice", top_k=5)

    assert len(hits) == 1
    assert hits[0]["section"] == "Cereals"


def test_course_link_handles_missing_slug():
    assert rag._course_link("", "Soil") == "/courses"
    assert rag._course_link("intro", "Soil & Water") == "/courses/intro#soil-water"


def test_describe_handles_wrapped_estimators(monkeypatch):
    wrapped = SimpleNamespace(best_estimator_=SimpleNamespace(n_estimators=17))
    monkeypatch.setattr(ml_model, "load_model", lambda: wrapped)

    assert ml_model.describe() == "simplenamespace(estimators=17)"

    pipeline = SimpleNamespace(named_steps={"scaler": object(), "model": SimpleNamespace(n_estimators=9)})
    monkeypatch.setattr(ml_model, "load_model", lambda: pipeline)
    assert ml_model.describe() == "simplenamespace(estimators=9)"
