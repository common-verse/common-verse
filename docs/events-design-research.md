# Events page design references

Research date: 24 October 2026.

Status: reference study and design recommendation, not an approved implementation
change. No application code was changed for this study.

The aim is a calmer cultural programme page: a substantial featured section,
readable event dates, and a list that remains easy to scan with around twenty
events. The references below were reviewed through first-party pages and desktop
screenshots. Mobile behaviour, keyboard interaction, accessibility, and performance
were not audited.

## References

| Reference                                                                            | Observed layout                                                                                                                                                                          | Useful direction for this project                                                                                                                                                 |
| ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Haus für Poesie — Programm](https://www.hausfuerpoesie.org/de/programm)             | A large programme heading and consistent event columns: date at the left, image in the middle, title at the right.                                                                       | Give dates and titles stable positions. Use strong typography and whitespace to establish hierarchy.                                                                              |
| [Literaturhaus Berlin — Veranstaltungen](https://li-be.de/programm/veranstaltungen/) | Bold, type-led rows place dates at the left, event text in the centre, and an action at the right. Filters sit above the programme; the list does not depend on an image for each entry. | Treat the programme as readable editorial information. Events without suitable photos should still look complete.                                                                 |
| [The Poetry Project, New York — Events](https://www.poetryproject.org/events)        | Repeated image-left/text-right rows and date headings create a predictable sequence. The page also has a substantial introductory text.                                                  | Consistent rows and date grouping are useful. The long introduction would delay the programme too much for our page. This is a separate organisation from The Poetry Project e.V. |
| [The Poetry Project e.V. — Lesungen](https://thepoetryproject.de/lesungen)           | Gold serif headings and documentary photography connect the programme to people and the association's work.                                                                              | Preserve this human, literary identity. Real photographs and carefully chosen typography should carry the character.                                                              |

The observations describe the reviewed pages. The proposed applications are
design judgments for this project, rather than claims about measured usability.

## Recommended direction

Use the original association's warmth with the programme structure of Haus für
Poesie and Literaturhaus Berlin. Let a featured event be expressive, then make
the rest of the programme quiet and predictable.

1. **A composed featured section.** Pair an image occupying roughly 60% of the
   section with a separate text area occupying 40%. Keep the title, short
   description, and facts on the page background. This allows documentary images
   to remain visible without dark overlays determining text legibility.
2. **Make the featured selection understandable.** Support one to five featured
   events without automatic rotation. When there is more than one, consider
   visible short event-title choices so visitors can see what else is available;
   a counter alone does not communicate that content. The exact control should
   be tested with the actual titles and narrow viewports before implementation.
3. **A steady chronological list.** Keep date, title, and image positions
   consistent. Use modest images, clear month headings, restrained dividers, and
   generous vertical space. Give the title the strongest emphasis within each
   row and let the facts remain supporting information.
4. **Use yellow deliberately.** Retain the familiar yellow facts treatment, but
   keep it subordinate to the title. Avoid making every event compete with a
   large highlighted strip, oversized photograph, or heavy background panel.
5. **Keep the introduction short.** One clear page title and one concise sentence
   should introduce the programme. Avoid stacking a large header, explanatory
   text, and another disconnected feature panel before the event list starts.

Alternating image sides can create an attractive rhythm for a short editorial
story. For this programme, the design concern is that every other event moves
the title and image to a different position, interrupting chronological scanning.
That is a design judgment, not a usability-test result. If alternation remains
the preferred visual direction, keep the dates on one consistent rail and
compare a few real rows against the fixed-column version before committing.

## What to validate before building

Compare the proposed featured section and three list rows with the actual event
photos and titles. Check a narrow viewport, enlarged text, Arabic or Persian RTL,
missing images, and multiple featured events. The reference study establishes a
visual direction; it does not establish that these interactions work in this
website.
