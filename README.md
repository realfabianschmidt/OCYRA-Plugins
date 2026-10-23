# OCYRA first-party plugins

This repository owns the v3 first-party plugin packages. SubRip now uses the sole API-v1
ES-module entry and explicit results. The foundation audit package remains a Q1.5 fixture
until the host.data.read response contract is decided. No package is signed or installed yet.

Run npm run verify, then npm run test:reference -- --reference <app GP02 directory>.
The reference path is an explicit checkout argument; no app source is copied here.

Historical Q1.5 evidence uses commit 0856ba3, not the current package tree. Supply a detached
checkout of that commit to the historical spike; there is no runtime compatibility adapter.
The app brief 38 owns end-to-end acceptance and the pinned product-package revision.
