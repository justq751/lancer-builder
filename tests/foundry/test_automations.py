import json
import pathlib
import re
import sys
import unittest
from unittest.mock import patch

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[2] / "tools"))
import audit_automations_i18n as audit
import export_foundry_locale as export


def flatten(node, prefix=""):
    return dict(audit.flatten(node, prefix))


class AuditTests(unittest.TestCase):
    def test_merge_keeps_translations_marks_changed_english_and_drops_vanished_keys(self):
        current = {
            "LA.a": {"en": "Same", "ru": "Тот же"},
            "LA.b": {"en": "Old", "ru": "Старый"},
            "LA.c": {"en": "Untranslated", "ru": ""},
            "LA.gone": {"en": "Gone", "ru": "Нет"},
        }
        merged = audit.merge_lang({"LA.a": "Same", "LA.b": "New", "LA.c": "Changed", "LA.new": "Fresh"}, current)
        self.assertEqual(merged["LA.a"], {"en": "Same", "ru": "Тот же"})
        self.assertEqual(merged["LA.b"], {"en": "New", "ru": "Старый", "stale": True})
        self.assertEqual(merged["LA.c"], {"en": "Changed", "ru": ""})
        self.assertEqual(merged["LA.new"], {"en": "Fresh", "ru": ""})
        self.assertNotIn("LA.gone", merged)

    def test_terms_follow_the_case_of_the_english_source(self):
        table = {"Boost": "Рывок"}
        self.assertEqual(audit.term_for("Boost", table), "Рывок")
        self.assertEqual(audit.term_for("BOOST", table), "РЫВОК")
        self.assertEqual(audit.term_for("boost", table), "рывок")
        self.assertIsNone(audit.term_for("Boosted", table))

    def test_site_terms_come_from_site_locales(self):
        table = audit.terms()
        actions = audit.read(audit.ROOT / "locales/ru/actions.json")
        self.assertEqual(table["Boost"], actions["act_boost"]["name"]["ru"])
        enums = audit.read(audit.ROOT / "locales/ru/enums.json")
        self.assertEqual(table["Flex"], enums["mount_types"]["Flex"]["ru"])

    def test_literal_extraction_skips_code_and_splits_html(self):
        source = """
        // A comment with 'Quoted text'
        console.log('Debug message here');
        const cls = 'la-hud-row active';
        const key = localize('LA.tokenHud.label.mount');
        const path = 'modules/lancer-automations/icons/x.svg';
        ui.notifications.info('Reload a Loading Weapon');
        const html = `<div class="la-card" title="Line of sight"><b>Regain ${amount} HP</b></div>`;
        """
        found = [text for _, text in audit.literals_in(source)]
        self.assertEqual(found, ["Reload a Loading Weapon", "Regain {…} HP", "Line of sight"])

    def test_snapshot_matches_lang_sources(self):
        lang = audit.read(audit.LANG_FILE)
        self.assertTrue(all(key.startswith(("LA.", "TYPES.")) for key in lang))
        literals = audit.read(audit.SNAPSHOT / "literals.json")
        self.assertTrue(all(isinstance(where, list) and where for where in literals.values()))


class ExportTests(unittest.TestCase):
    def test_markup_must_match(self):
        export.same_markup("Hello {name}, <b>go</b>", "Привет, {name}, <b>вперёд</b>", "ok")
        for ru in ["Привет, {имя}", "Привет, {name}, вперёд", "<i>{name}</i> <b>go</b>"]:
            with self.assertRaisesRegex(ValueError, "placeholders or HTML"):
                export.same_markup("Hello {name}, <b>go</b>", ru, "bad")

    def test_generated_language_file_only_has_known_keys_and_valid_markup(self):
        files = export.build_automations()
        lang = audit.read(audit.LANG_FILE)
        generated = flatten(json.loads(files["lang/automations.ru.json"]))
        self.assertTrue(generated)
        for key, ru in generated.items():
            self.assertIn(key, lang)
            export.same_markup(lang[key]["en"], ru, key)

    def test_stale_translation_is_not_exported(self):
        read = audit.read

        def changed(path):
            data = read(path)
            if path == audit.LANG_FILE:
                data["LA.common.cancel"] = {"en": data["LA.common.cancel"]["en"], "ru": "Старое", "stale": True}
            return data

        with patch.object(audit, "read", side_effect=changed):
            generated = flatten(json.loads(export.build_automations()["lang/automations.ru.json"]))
        self.assertNotEqual(generated.get("LA.common.cancel"), "Старое")

    def test_text_patterns_must_match_their_example(self):
        read = audit.read

        def with_pattern(example):
            def changed(path):
                data = read(path)
                if path == audit.TEXT_FILE:
                    data[r"/Regain (\d+) HP/"] = {"ru": "Восстановить $1 ОЗ", "example": example}
                return data
            return changed

        with patch.object(audit, "read", side_effect=with_pattern("Regain 5 HP")):
            text = export.build_automations()["generated/automations-text.js"]
            self.assertIn(r"Regain (\\d+) HP", text)
        with patch.object(audit, "read", side_effect=with_pattern("Regain all HP")):
            with self.assertRaisesRegex(ValueError, "example"):
                export.build_automations()

    def test_mount_type_uses_site_enums(self):
        files = export.build_automations()
        formats = json.loads(re.sub(r"^//.*\nexport default |;\n$", "", files["generated/automations-format.js"]))
        enums = audit.read(audit.ROOT / "locales/ru/enums.json")
        self.assertEqual(formats["LA.tokenHud.label.mount"]["type"]["Main"], enums["mount_types"]["Main"]["ru"])


if __name__ == "__main__":
    unittest.main()
