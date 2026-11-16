# `<레포 기준 파일 경로>`

> 기준: <hash 앞 7자리>[ (커밋 안 된 변경 포함)]
> 소속: [module <module id>](<up>/<moduleDoc>) · [아키텍처](<up>/<TOP_DOCS.architecture>)

## 한 줄 요약
이 파일이 무엇인지 한 문장 (DTO, 상수 모음, 빌드 설정, DB 마이그레이션 등).

## 역할
담고 있는 것과 존재 이유 2~5줄. `secret` 파일이면 `keys` 출력으로 본 키 이름 목록과 각 키의 용도 (값은 쓰지 않음).

## 영향을 주는 곳
이 파일을 읽거나 쓰는 코드, 이 설정·스키마에 따라 동작이 바뀌는 곳. 파일 문서로 링크 + 근거. 설정 파일이면 doc-style §5 "Reverse check for config files"대로 키마다(relaxed binding 변형 포함) 코드를 Grep해서 채운다. 어디서도 안 쓰는 키는 "사용처 못 찾음"으로 적는다.
