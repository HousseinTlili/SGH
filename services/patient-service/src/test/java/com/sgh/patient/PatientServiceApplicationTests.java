package com.sgh.patient;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

@SpringBootTest
@ActiveProfiles("test")
class PatientServiceApplicationTests {

	static {
		TestDatabase.ensure();
	}

	@Test
	void contextLoads() {
	}

}
