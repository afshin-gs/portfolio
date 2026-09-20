# Minimal TeX Live for this CV — scheme-basic plus exactly the packages
# main.tex/imports.tex pull in. Nothing is installed on the host; the image is
# the only "LaTeX install" that exists.
#
# Rebuild after adding a \usepackage that is not in the list below:
#   bun run cv:image
FROM texlive/texlive:latest-basic

# One tlmgr call so the whole thing is a single layer. tlmgr resolves each
# package's own dependencies.
RUN tlmgr update --self \
 && tlmgr install \
      latexmk \
      geometry \
      fancyhdr \
      lastpage \
      titlesec \
      needspace \
      enumitem \
      ragged2e \
      xcolor \
      microtype \
      fontawesome5 \
      hyperref \
      xkeyval \
      infwarerr \
      kvoptions \
      ltxcmds \
      etoolbox \
      trimspaces \
      cfr-lm \
      svn-prov \
      mweights \
      nfssext-cfr \
      cm-super \
      xcharter \
      fontaxes \
      xstring \
 && tlmgr path add \
 && rm -rf /usr/local/texlive/*/texmf-var/web2c/*.log

WORKDIR /cv
