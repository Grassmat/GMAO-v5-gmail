# Remplacer la sauvegarde sur GitHub

1. Décompresser le ZIP et ouvrir le dossier gmao-… correspondant à l’édition choisie.
2. Utiliser un dépôt distinct pour chaque édition afin de ne pas mélanger Gmail, Outlook, sans mails et les variantes Relevés.
3. Dans GitHub : Add file → Upload files. Glisser le CONTENU du dossier, fichiers ET sous-dossiers, puis Commit changes. Un ZIP seul n’est pas décompressé par GitHub.
4. Pour remplacer une ancienne sauvegarde, supprimer aussi les anciens fichiers qui n’existent plus dans cette édition. Téléverser des fichiers ne supprime pas les anciens modules.
5. Vérifier que app, lib, db, drizzle, scripts, build, public, package.json et pnpm-lock.yaml sont présents.

Si un fichier caché est refusé lors du glisser-déposer, utiliser Add file → Create new file et saisir son chemin complet. Les principaux fichiers de configuration se trouvent dans le ZIP :

- .openai/hosting.json : {"d1":"DB","r2":"BUCKET"} — aucun identifiant de Site préconfiguré.
- .gitignore : exclut dépendances, fichiers de compilation et vrais secrets locaux.
- .npmrc : réglages de l’installateur.
- .dev.vars.example : exemples sans identifiants réels. Ne jamais envoyer .dev.vars ou .env contenant vos secrets.

Le logo se remplace via public/brand/company.svg ; le nom via lib/branding.ts.
Lire README.md avant installation. Cette application requiert un serveur Workers, une base D1 et un stockage R2 : GitHub Pages seul ne suffit pas. Aucune donnée de votre installation en ligne n’est incluse ni modifiée par cette sauvegarde du code.
