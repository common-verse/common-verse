# Accounts and permissions

## MVP: managed editorial accounts

Only Administrator and Editor accounts can use the Payload admin or edit content.
There is no public registration, contributor login, or account-to-author link.
The developer is the Administrator. Content managers receive Editor accounts and
primarily create and publish articles and events.

| Capability                                                | Administrator | Editor |
| --------------------------------------------------------- | ------------- | ------ |
| Create, edit, publish and delete articles and events      | Yes           | Yes    |
| Manage shared locations                                   | Yes           | Yes    |
| Manage images and fixed pages                             | Yes           | Yes    |
| Manage shop products and settings; view and update orders | Yes           | Yes    |
| View carts and payment transactions; delete orders        | Yes           | No     |
| Edit own account details                                  | Yes           | Yes    |
| Create Editor accounts                                    | Yes           | Yes    |
| Delete accounts and assign Administrator roles            | Yes           | No     |
| Manage MCP API keys                                       | Yes           | No     |

Permissions are enforced by Payload access controls, including API requests;
hiding controls is not the security boundary. Editors cannot promote themselves
or assign Administrator roles. Editors can create and view other Editor accounts,
but can update only their own account and cannot see Administrator accounts. The native account screen remains available. Account
creation defaults to Editor, while Payload's first-account setup explicitly makes
the first account an Administrator. On an existing installation, ensure the
intended developer account has `role: admin` before enforcing these rules.
See [migrations](migrations.md) before upgrading an existing database.
Do not guess an administrator from an email address or create credentials in seeds.
Shop buyers check out as guests and never receive accounts; see [shop](shop.md).

The last Administrator cannot be demoted to Editor or deleted. Promote another
user to Administrator first. Payload rejects and rolls back changes that would
leave no Administrator, including simultaneous demotions and bulk deletions.

Content models and admin organization are in [editorial models](editorial-models.md).

## v2.0: contributor accounts and connected credits

Authors are public contributor profiles; Users are private login accounts. An
Author can represent a poet, article writer or translator without having an account.
An editor may enter content on their behalf. Link an invited User optionally to
one Author profile; the account connection is private and managed by administrators.
Do not derive public credit from whoever last edited a record.

Poems link to their original Author. Articles gain an Author relationship.
Each poem translation (a poem locale other than the original) gains a translator
relationship to an Author profile, separate from the original poem author. Under an Author, show their poems, articles and translations using native Payload relationships and reverse joins.
Preserve original-language text and existing translator attribution during migration;
resolve existing text credits explicitly rather than guessing matches by name.

Add a Contributor role only in v2.0. One role can serve writers and translators.
Contributors edit their own profile and explicitly assigned content, save drafts
and submit for editorial review. Editors retain final publication control.
Assignments and credit are separate: writing a translation does not grant editing
access to the original poem or to another person's translation. Contributors
cannot change ownership, account links, roles, or publication status themselves.

Current translations are localized fields of the poem, one per site locale.
Before allowing independent translator editing, review whether to move them to
their own collection, linked to the source poem, with independent drafts, versions
and publication approval. Document-level ownership checks alone cannot safely
authorize one locale. Migration must preserve translation content, languages,
credits and versions,
and public rendering must keep each original and translation's actual language
and direction. Test permission enforcement through REST, GraphQL and the Local
API (`overrideAccess: false`), not just dashboard visibility. Include attempts to
edit another contributor's content, overwrite another translation, publish without
review, and assign oneself broader privileges.

Self-service signup, account claiming, invitations and password delivery are
separate v2.0 decisions. Start with administrator-managed invitations; never
expose private account email addresses through public Author profiles.
