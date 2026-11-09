package com.example.demo.genre;

import org.springframework.data.jpa.repository.JpaRepository;

/** TagNormalization CRUD. PK가 tag 문자열이라 findById/save로 충분. */
public interface TagNormalizationRepository extends JpaRepository<TagNormalization, String> {
}
