import argparse
import json


def analyze_permanent_skill_alternatives(skill_data: dict) -> dict:
    report = {
        "skillsWithPermanentAlternative": 0,
        "skillsWithOnlyPermanentAlternatives": 0,
        "skillsWithMixedPermanentAlternatives": [],
        "skillsWithMultiplePermanentAlternatives": [],
        "skillsWithAnyPermanentAndMultipleAlternatives": [],
    }

    for skill_id, entry in skill_data.items():
        alternatives = entry.get("alternatives", [])
        durations = [alternative.get("baseDuration") for alternative in alternatives]
        permanent_count = sum(1 for duration in durations if duration == -1)

        if permanent_count <= 0:
            continue

        report["skillsWithPermanentAlternative"] += 1

        if durations and all(duration == -1 for duration in durations):
            report["skillsWithOnlyPermanentAlternatives"] += 1

        if len(alternatives) > 1:
            report["skillsWithAnyPermanentAndMultipleAlternatives"].append(
                {
                    "skillId": skill_id,
                    "baseDurations": durations,
                }
            )

        if permanent_count > 1:
            report["skillsWithMultiplePermanentAlternatives"].append(
                {
                    "skillId": skill_id,
                    "baseDurations": durations,
                }
            )

        if permanent_count > 0 and any(duration != -1 for duration in durations):
            report["skillsWithMixedPermanentAlternatives"].append(
                {
                    "skillId": skill_id,
                    "baseDurations": durations,
                }
            )

    return report


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--skill-data",
        default="assets/data/skill_data.json",
        help="path to generated skill_data.json",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="print the full report as JSON",
    )
    args = parser.parse_args()

    with open(args.skill_data, "r", encoding="utf-8") as f:
        skill_data = json.load(f)

    report = analyze_permanent_skill_alternatives(skill_data)

    if args.json:
        print(json.dumps(report, ensure_ascii=False, indent=2))
        return

    print(
        "permanent alternative summary: total=%d, only_permanent=%d, mixed=%d, multi_permanent=%d, multi_alternative_with_permanent=%d"
        % (
            report["skillsWithPermanentAlternative"],
            report["skillsWithOnlyPermanentAlternatives"],
            len(report["skillsWithMixedPermanentAlternatives"]),
            len(report["skillsWithMultiplePermanentAlternatives"]),
            len(report["skillsWithAnyPermanentAndMultipleAlternatives"]),
        )
    )

    if report["skillsWithMixedPermanentAlternatives"]:
        print("mixed permanent alternatives:")
        for item in report["skillsWithMixedPermanentAlternatives"]:
            print("  - %s %s" % (item["skillId"], item["baseDurations"]))

    if report["skillsWithMultiplePermanentAlternatives"]:
        print("multiple permanent alternatives:")
        for item in report["skillsWithMultiplePermanentAlternatives"]:
            print("  - %s %s" % (item["skillId"], item["baseDurations"]))


if __name__ == "__main__":
    main()
