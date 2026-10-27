# Ruoli della chiave di rilascio di MotoMentor AI, letti da scripts/verify-tag.sh.
# Unico punto in cui le impronte sono scritte (e nel README, per chi verifica).
# Modello ripreso da Plico: la CI non firma niente (gli allegati hanno
# SHA256SUMS e l'attestazione di provenienza di GitHub), quindi non c'è una
# sottochiave per la CI.
#
# DA COMPLETARE: le impronte si scrivono dopo aver creato la chiave
# (packaging/README.md, «Configurazione»). Finché sono vuote, verify-tag.sh
# rifiuta ogni tag e la release non parte.
#
# La primaria [C], solo sulla macchina del maintainer: certifica le
# sottochiavi. Non firma nulla.
RELEASE_PRIMARY="${B9BE9034B84C16D70F8BB0DDB26652F3D81EACE4:-}"
# Sottochiavi che possono firmare i TAG: solo quelle del maintainer, mai nella
# CI. Più di una, separate da spazi, solo durante una rotazione.
TAG_SIGNING_SUBKEYS="${989392EDD3CC209FC62D73D41B75E7B40108A445:-}"
